import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import type { Env } from '../../config/env.schema.js';
import { AuthCookies } from './auth.cookies.js';

interface SetCall {
  name: string;
  options: { path?: string; secure?: boolean; domain?: string };
}

function create(env: { COOKIE_SECURE: boolean; COOKIE_DOMAIN?: string }) {
  const config = { get: (key: keyof typeof env) => env[key] };
  return new AuthCookies(config as unknown as ConfigService<Env, true>);
}

function fakeResponse() {
  const set: SetCall[] = [];
  const cleared: SetCall[] = [];
  const res = {
    cookie: (name: string, _value: string, options: SetCall['options']) =>
      set.push({ name, options }),
    clearCookie: (name: string, options: SetCall['options']) => cleared.push({ name, options }),
  };
  return { res: res as unknown as Response, set, cleared };
}

function request(cookies: Record<string, string>, authorization?: string): Request {
  return {
    cookies,
    header: (name: string) => (name === 'authorization' ? authorization : undefined),
  } as unknown as Request;
}

const tokens = {
  accessToken: 'access',
  accessTokenExpiresAt: new Date(Date.now() + 60_000),
  refreshToken: 'refresh',
  refreshTokenExpiresAt: new Date(Date.now() + 86_400_000),
};

describe('AuthCookies', () => {
  it('HTTPS’da: __Host- nomlar, Path=/ — qo‘shni subdomen cookie’ni almashtira olmaydi', () => {
    const cookies = create({ COOKIE_SECURE: true });
    const { res, set, cleared } = fakeResponse();
    cookies.set(res, tokens);
    expect(set.map(({ name, options }) => [name, options.path])).toEqual([
      ['__Host-sg_at', '/'],
      ['__Host-sg_rt', '/'],
      ['__Host-sg_auth', '/'],
    ]);
    expect(set.every(({ options }) => options.secure && !options.domain)).toBe(true);

    // Prefikssiz cookie (masalan, *.sslip.io dagi boshqa saytdan "tashlangan") o'qilmaydi
    expect(cookies.readAccessToken(request({ sg_at: 'begona' }))).toBeUndefined();
    expect(cookies.readRefreshToken(request({ sg_rt: 'begona' }))).toBeUndefined();
    expect(cookies.readAccessToken(request({ '__Host-sg_at': 'mening' }))).toBe('mening');
    expect(cookies.readRefreshToken(request({ '__Host-sg_rt': 'mening' }))).toBe('mening');
    expect(cookies.readAccessToken(request({}, 'Bearer mobil'))).toBe('mobil');

    // Chiqishda eski (prefikssiz) cookie'lar ham tozalanadi
    cookies.clear(res);
    expect(cleared.map(({ name }) => name)).toEqual([
      '__Host-sg_at',
      '__Host-sg_rt',
      '__Host-sg_auth',
      'sg_at',
      'sg_rt',
      'sg_auth',
    ]);
  });

  it('lokal HTTP’da: oddiy nomlar, refresh faqat /api/v1/auth da', () => {
    const cookies = create({ COOKIE_SECURE: false });
    const { res, set, cleared } = fakeResponse();
    cookies.set(res, tokens);
    expect(set.map(({ name, options }) => [name, options.path])).toEqual([
      ['sg_at', '/'],
      ['sg_rt', '/api/v1/auth'],
      ['sg_auth', '/'],
    ]);
    expect(cookies.readAccessToken(request({ sg_at: 'token' }))).toBe('token');
    cookies.clear(res);
    expect(cleared).toHaveLength(3);
  });

  it('COOKIE_DOMAIN berilsa — prefikssiz (__Host- Domain bilan ishlamaydi)', () => {
    const cookies = create({ COOKIE_SECURE: true, COOKIE_DOMAIN: '.santexgo.uz' });
    const { res, set } = fakeResponse();
    cookies.set(res, tokens);
    expect(set.map(({ name }) => name)).toEqual(['sg_at', 'sg_rt', 'sg_auth']);
  });
});
