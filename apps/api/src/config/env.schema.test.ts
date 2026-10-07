import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/santexgo',
  AUTH_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('standart qiymatlarni qo‘llaydi', () => {
    const env = validateEnv(base);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 4000,
      APP_TIMEZONE: 'Asia/Tashkent',
      DATABASE_POOL_SIZE: 10,
      CORS_ORIGINS: [],
      SWAGGER_ENABLED: false,
      ACCESS_TOKEN_TTL_MINUTES: 15,
      REFRESH_TOKEN_TTL_DAYS: 30,
      COOKIE_SECURE: false,
      SMS_PROVIDER: 'console',
    });
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('matnli qiymatlarni to‘g‘ri turga o‘giradi', () => {
    const env = validateEnv({
      ...base,
      PORT: '8080',
      SWAGGER_ENABLED: 'true',
      CORS_ORIGINS: 'http://localhost:3000, https://santexgo.uz',
      REDIS_URL: 'redis://:secret@127.0.0.1:6379',
    });
    expect(env.PORT).toBe(8080);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://santexgo.uz']);
    expect(env.REDIS_URL).toBe('redis://:secret@127.0.0.1:6379');
  });

  it('bo‘sh qiymatni berilmagan deb hisoblaydi', () => {
    const env = validateEnv({ ...base, REDIS_URL: '', COOKIE_DOMAIN: '', ESKIZ_EMAIL: '' });
    expect(env.REDIS_URL).toBeUndefined();
    expect(env.COOKIE_DOMAIN).toBeUndefined();
  });

  it('production’da cookie standart bo‘yicha faqat HTTPS', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      SMS_PROVIDER: 'eskiz',
      ESKIZ_EMAIL: 'shop@santexgo.uz',
      ESKIZ_PASSWORD: 'secret',
    });
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it('ortiqcha o‘zgaruvchilarni tashlab yuboradi', () => {
    expect(validateEnv({ ...base, PATH: '/usr/bin' })).not.toHaveProperty('PATH');
  });

  it('noto‘g‘ri sozlamada aniq xato beradi', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...base, PORT: '70000' })).toThrow(/PORT/);
    expect(() => validateEnv({ ...base, APP_TIMEZONE: 'Mars/Base' })).toThrow(/APP_TIMEZONE/);
    expect(() => validateEnv({ ...base, CORS_ORIGINS: 'not-a-url' })).toThrow(/CORS_ORIGINS/);
    expect(() => validateEnv({ ...base, AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET/);
    expect(() => validateEnv({ ...base, REDIS_URL: 'localhost:6379' })).toThrow(/REDIS_URL/);
  });

  it('SMS provayder sozlamalarini tekshiradi', () => {
    expect(() => validateEnv({ ...base, SMS_PROVIDER: 'eskiz' })).toThrow(/ESKIZ_EMAIL/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/SMS_PROVIDER/);
  });
});
