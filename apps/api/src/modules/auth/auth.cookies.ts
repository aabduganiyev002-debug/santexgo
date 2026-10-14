import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { AUTH_COOKIES, HOST_COOKIE_PREFIX } from '@santexgo/shared';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../../config/env.schema.js';

/** Refresh cookie yo'li lokal HTTP'da: faqat auth manzillariga yuboriladi. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export interface CookieTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
}

interface CookieNames {
  access: string;
  refresh: string;
  hint: string;
}

const LEGACY_NAMES: CookieNames = AUTH_COOKIES;

/**
 * Auth cookie'lari: hammasi httpOnly (JavaScript o'qiy olmaydi — XSS'dan himoya),
 * SameSite (boshqa saytdan so'rov yuborib bo'lmaydi), production'da faqat HTTPS.
 *
 * HTTPS'da va COOKIE_DOMAIN'siz (production) nomlar `__Host-` prefiksi bilan: brauzer bunday
 * cookie'ni faqat shu hostning o'zidan qabul qiladi. Qo'shni subdomendagi sayt (masalan, bepul
 * manzil *.sslip.io dagi boshqa sayt) o'z cookie'sini "tashlab", mijozni o'z akkauntiga kirgizib
 * qo'ya olmaydi. `__Host-` faqat Path=/ bilan — shuning uchun refresh cookie ham "/" yo'lida.
 */
@Injectable()
export class AuthCookies {
  private readonly base: CookieOptions;
  private readonly names: CookieNames;
  private readonly refreshPath: string;
  /** Oldingi (prefikssiz) nomlar — chiqishda ular ham tozalanadi */
  private readonly legacy: boolean;

  constructor(config: ConfigService<Env, true>) {
    const secure = config.get('COOKIE_SECURE', { infer: true });
    const domain = config.get('COOKIE_DOMAIN', { infer: true });
    this.base = { secure, domain };
    const hostOnly = secure && !domain;
    const prefix = hostOnly ? HOST_COOKIE_PREFIX : '';
    this.names = {
      access: `${prefix}${AUTH_COOKIES.access}`,
      refresh: `${prefix}${AUTH_COOKIES.refresh}`,
      hint: `${prefix}${AUTH_COOKIES.hint}`,
    };
    this.refreshPath = hostOnly ? '/' : REFRESH_COOKIE_PATH;
    this.legacy = hostOnly;
  }

  set(res: Response, tokens: CookieTokens): void {
    res.cookie(this.names.access, tokens.accessToken, {
      ...this.base,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: tokens.accessTokenExpiresAt,
    });
    if (tokens.refreshToken && tokens.refreshTokenExpiresAt) {
      res.cookie(this.names.refresh, tokens.refreshToken, {
        ...this.base,
        httpOnly: true,
        sameSite: 'strict',
        path: this.refreshPath,
        expires: tokens.refreshTokenExpiresAt,
      });
      res.cookie(this.names.hint, '1', {
        ...this.base,
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        expires: tokens.refreshTokenExpiresAt,
      });
    }
  }

  clear(res: Response): void {
    res.clearCookie(this.names.access, { ...this.base, path: '/' });
    res.clearCookie(this.names.refresh, { ...this.base, path: this.refreshPath });
    res.clearCookie(this.names.hint, { ...this.base, path: '/' });
    if (this.legacy) {
      // Prefikssiz nomli eski cookie'lar (oldingi versiyadan) brauzerda qolib ketmasin
      res.clearCookie(LEGACY_NAMES.access, { ...this.base, path: '/' });
      res.clearCookie(LEGACY_NAMES.refresh, { ...this.base, path: REFRESH_COOKIE_PATH });
      res.clearCookie(LEGACY_NAMES.hint, { ...this.base, path: '/' });
    }
  }

  readRefreshToken(req: Request): string | undefined {
    return readCookie(req, this.names.refresh);
  }

  /** Access token: avval "Authorization: Bearer", keyin cookie. */
  readAccessToken(req: Request): string | undefined {
    const header = req.header('authorization');
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7).trim();
      return token || undefined;
    }
    return readCookie(req, this.names.access);
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
