import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const QUIET_PATHS = ['/api/health'];

/**
 * Har bir so'rovga ID beradi (javob sarlavhasida qaytadi) va natijani logga yozadi:
 * "GET /api/v1/products 200 12.4ms [request-id]". Xatolarni loglar orqali tez topishga yordam beradi.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(REQUEST_ID_HEADER);
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const startedAt = performance.now();
    res.on('finish', () => {
      if (QUIET_PATHS.some((path) => req.originalUrl.startsWith(path)) && res.statusCode < 400)
        return;
      const durationMs = (performance.now() - startedAt).toFixed(1);
      const url =
        req.originalUrl.length > 300 ? `${req.originalUrl.slice(0, 300)}…` : req.originalUrl;
      const message = `${req.method} ${url} ${res.statusCode} ${durationMs}ms [${requestId}]`;
      if (res.statusCode >= 500) this.logger.error(message);
      else if (res.statusCode >= 400) this.logger.warn(message);
      else this.logger.log(message);
    });

    next();
  }
}
