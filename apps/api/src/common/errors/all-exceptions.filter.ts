import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ApiErrorBody, ApiErrorCode, ApiFieldError } from '@santexgo/shared';
import type { Request, Response } from 'express';
import { mapPrismaError } from './prisma-error.js';

const DEFAULT_CODES: Partial<Record<number, ApiErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'BAD_REQUEST',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

const DEFAULT_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'So‘rov noto‘g‘ri',
  [HttpStatus.UNAUTHORIZED]: 'Avval tizimga kiring',
  [HttpStatus.FORBIDDEN]: 'Bu amal uchun ruxsat yo‘q',
  [HttpStatus.NOT_FOUND]: 'Sahifa yoki ma’lumot topilmadi',
  [HttpStatus.CONFLICT]: 'Ma’lumotlar ziddiyati',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Yuborilgan ma’lumot hajmi juda katta',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Juda ko‘p so‘rov. Birozdan keyin qayta urinib ko‘ring',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Xizmat vaqtincha ishlamayapti',
};

function httpErrorStatus(exception: unknown): number | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const { status, expose } = exception as { status?: unknown; expose?: unknown };
  if (typeof status === 'number' && status >= 400 && status < 500 && expose === true) {
    return status;
  }
  return null;
}

interface ErrorPayload {
  code?: ApiErrorCode;
  message?: string | string[];
  errors?: ApiFieldError[];
  retryAfter?: number;
}

/**
 * Barcha xatolarni yagona formatga keltiradi: { statusCode, code, message, errors?, requestId }.
 * 500 xatolarning tafsilotlari faqat logga yoziladi, mijozga ko'rsatilmaydi.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = req.headers['x-request-id'] as string | undefined;

    const body = this.toBody(exception, req);
    body.requestId = requestId;

    if (body.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`${req.method} ${req.originalUrl} [${requestId}] ${stack}`);
    }
    if (body.retryAfter !== undefined) {
      res.setHeader('Retry-After', String(body.retryAfter));
    }
    if (!res.headersSent) {
      res.status(body.statusCode).json(body);
    }
  }

  private toBody(exception: unknown, req: Request): ApiErrorBody {
    if (exception instanceof ThrottlerException) {
      const retryAfter = Number(req.res?.getHeader('Retry-After')) || undefined;
      return {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        code: 'RATE_LIMITED',
        message: DEFAULT_MESSAGES[HttpStatus.TOO_MANY_REQUESTS]!,
        retryAfter,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      const payload: ErrorPayload =
        typeof response === 'object' && response !== null ? (response as ErrorPayload) : {};
      // Nest'ning standart xatolarida (masalan, 404) message inglizcha bo'ladi — o'zbekchasiga almashtiriladi
      const message =
        payload.code && typeof payload.message === 'string'
          ? payload.message
          : (DEFAULT_MESSAGES[statusCode] ?? 'Xatolik yuz berdi');
      return {
        statusCode,
        code:
          payload.code ??
          DEFAULT_CODES[statusCode] ??
          (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST'),
        message,
        errors: payload.errors,
        retryAfter: payload.retryAfter,
      };
    }

    const prisma = mapPrismaError(exception);
    if (prisma) {
      return { statusCode: prisma.status, code: prisma.code, message: prisma.message };
    }

    // body-parser xatolari (buzilgan JSON, juda katta so'rov) — http-errors formatida keladi
    const clientStatus = httpErrorStatus(exception);
    if (clientStatus !== null) {
      return {
        statusCode: clientStatus,
        code: DEFAULT_CODES[clientStatus] ?? 'BAD_REQUEST',
        message:
          clientStatus === HttpStatus.BAD_REQUEST
            ? 'So‘rov noto‘g‘ri formatda'
            : (DEFAULT_MESSAGES[clientStatus] ?? 'So‘rov noto‘g‘ri'),
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Serverda xatolik yuz berdi. Birozdan keyin qayta urinib ko‘ring',
    };
  }
}
