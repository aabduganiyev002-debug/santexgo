import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

const base = { DATABASE_URL: 'postgresql://user:pass@localhost:5432/santexgo' };

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
    });
  });

  it('matnli qiymatlarni to‘g‘ri turga o‘giradi', () => {
    const env = validateEnv({
      ...base,
      PORT: '8080',
      SWAGGER_ENABLED: 'true',
      CORS_ORIGINS: 'http://localhost:3000, https://santexgo.uz',
    });
    expect(env.PORT).toBe(8080);
    expect(env.SWAGGER_ENABLED).toBe(true);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://santexgo.uz']);
  });

  it('ortiqcha o‘zgaruvchilarni tashlab yuboradi', () => {
    expect(validateEnv({ ...base, PATH: '/usr/bin' })).not.toHaveProperty('PATH');
  });

  it('noto‘g‘ri sozlamada aniq xato beradi', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ ...base, PORT: '70000' })).toThrow(/PORT/);
    expect(() => validateEnv({ ...base, APP_TIMEZONE: 'Mars/Base' })).toThrow(/APP_TIMEZONE/);
    expect(() => validateEnv({ ...base, CORS_ORIGINS: 'not-a-url' })).toThrow(/CORS_ORIGINS/);
  });
});
