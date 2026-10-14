import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SKIP_CSRF_KEY } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import type { Env } from '../../../config/env.schema.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF himoyasi: ma'lumot o'zgartiradigan so'rov (POST, PATCH, DELETE...) brauzerdan kelsa,
 * u faqat ruxsat etilgan saytlardan (CORS_ORIGINS) yoki API'ning o'zidan bo'lishi kerak.
 * Cookie'lar SameSite bo'lgani bilan birga — ikki qavatli himoya.
 * Bearer token bilan kelgan so'rovlar (mobil ilova) va brauzerdan bo'lmagan so'rovlar tekshirilmaydi.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService<Env, true>,
  ) {
    this.allowedOrigins = new Set(
      config.get('CORS_ORIGINS', { infer: true }).map((origin) => new URL(origin).origin),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (
      this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    if (req.header('authorization')?.startsWith('Bearer ')) return true;

    const rawOrigin = req.header('origin');
    const origin = rawOrigin !== undefined ? originOf(rawOrigin) : originOf(req.header('referer'));
    if (origin === null) {
      // "Origin: null" (sandbox iframe va h.k.) — rad etiladi
      if (rawOrigin !== undefined) throw this.reject();
      // Origin yo'q — brauzer emas (curl, server). Brauzer "cross-site" desa — rad etiladi
      if (req.header('sec-fetch-site') === 'cross-site') throw this.reject();
      return true;
    }
    const self = `${req.protocol}://${req.get('host') ?? ''}`;
    if (this.allowedOrigins.has(origin) || origin === self) return true;
    throw this.reject();
  }

  private reject(): ApiError {
    return ApiError.forbidden('CSRF_REJECTED', 'So‘rov rad etildi: ruxsat etilmagan manba');
  }
}
