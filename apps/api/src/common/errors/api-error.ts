import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorCode, ApiFieldError } from '@santexgo/shared';

interface ApiErrorOptions {
  errors?: ApiFieldError[];
  retryAfter?: number;
}

/**
 * Barqaror kodli API xatosi. Frontend matnga emas, `code` ga tayanadi;
 * `message` foydalanuvchiga ko'rsatiladigan o'zbekcha matn.
 */
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ApiErrorCode,
    message: string,
    details: ApiErrorOptions = {},
  ) {
    super({ code, message, ...details }, status);
  }

  static badRequest(code: ApiErrorCode, message: string, options?: ApiErrorOptions): ApiError {
    return new ApiError(HttpStatus.BAD_REQUEST, code, message, options);
  }

  static unauthorized(code: ApiErrorCode, message: string): ApiError {
    return new ApiError(HttpStatus.UNAUTHORIZED, code, message);
  }

  static forbidden(code: ApiErrorCode, message: string): ApiError {
    return new ApiError(HttpStatus.FORBIDDEN, code, message);
  }

  static notFound(message: string): ApiError {
    return new ApiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', message);
  }

  static conflict(code: ApiErrorCode, message: string, options?: ApiErrorOptions): ApiError {
    return new ApiError(HttpStatus.CONFLICT, code, message, options);
  }

  /** Forma maydoniga bog'langan xato: { errors: [{ field, message }] } */
  static field(status: HttpStatus, code: ApiErrorCode, field: string, message: string): ApiError {
    return new ApiError(status, code, message, { errors: [{ field, message }] });
  }

  static tooManyRequests(code: ApiErrorCode, message: string, retryAfter?: number): ApiError {
    return new ApiError(HttpStatus.TOO_MANY_REQUESTS, code, message, { retryAfter });
  }

  static serviceUnavailable(code: ApiErrorCode, message: string): ApiError {
    return new ApiError(HttpStatus.SERVICE_UNAVAILABLE, code, message);
  }
}
