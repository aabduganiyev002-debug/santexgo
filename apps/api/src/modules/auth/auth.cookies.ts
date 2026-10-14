import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { AUTH_COOKIES } from '@santexgo/shared';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../../config/env.schema.js';

/** Refresh cookie faqat auth manzillariga yuboriladi (boshqa so'rovlarda ko'rinmaydi). */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export interface CookieTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
}

/**
 * Auth cookie'lari: hammasi httpOnly (JavaScript o'qiy olmaydi — XSS'dan himoya),
 * SameSite (boshqa saytdan so'rov yuborib bo'lmaydi), production'da faqat HTTPS.
 */
@Injectable()
export class AuthCookies {
  private readonly base: CookieOptions;

  constructor(config: ConfigService<Env, true>) {
    this.base = {
      secure: config.get('COOKIE_SECURE', { infer: true }),
      domain: config.get('COOKIE_DOMAIN', { infer: true }),
    };
  }

  set(res: Response, tokens: CookieTokens): void {
    res.cookie(AUTH_COOKIES.access, tokens.accessToken, {
      ...this.base,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: tokens.accessTokenExpiresAt,
    });
    if (tokens.refreshToken && tokens.refreshTokenExpiresAt) {
      res.cookie(AUTH_COOKIES.refresh, tokens.refreshToken, {
        ...this.base,
        httpOnly: true,
        sameSite: 'strict',
        path: REFRESH_COOKIE_PATH,
        expires: tokens.refreshTokenExpiresAt,
      });
      res.cookie(AUTH_COOKIES.hint, '1', {
        ...this.base,
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        expires: tokens.refreshTokenExpiresAt,
      });
    }
  }

  clear(res: Response): void {
    res.clearCookie(AUTH_COOKIES.access, { ...this.base, path: '/' });
    res.clearCookie(AUTH_COOKIES.refresh, { ...this.base, path: REFRESH_COOKIE_PATH });
    res.clearCookie(AUTH_COOKIES.hint, { ...this.base, path: '/' });
  }

  readRefreshToken(req: Request): string | undefined {
    const value = (req.cookies as Record<string, unknown> | undefined)?.[AUTH_COOKIES.refresh];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}

/** Access token: avval "Authorization: Bearer", keyin cookie. */
export function readAccessToken(req: Request): string | undefined {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    return token || undefined;
  }
  const value = (req.cookies as Record<string, unknown> | undefined)?.[AUTH_COOKIES.access];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
