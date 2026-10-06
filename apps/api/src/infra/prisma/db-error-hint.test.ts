import { describe, expect, it } from 'vitest';
import { dbErrorHint } from './db-error-hint.js';

// Prisma 7 + @prisma/adapter-pg xatolarining haqiqiy tuzilishi (lokal PostgreSQL'da olingan)
function adapterError(cause: Record<string, unknown>) {
  return { code: 'P2010', meta: { driverAdapterError: { name: 'DriverAdapterError', cause } } };
}

describe('dbErrorHint', () => {
  it('baza ishlamayotganda Docker haqida eslatadi', () => {
    const hint = dbErrorHint(
      adapterError({ kind: 'DatabaseNotReachable', host: '127.0.0.1', port: 5432 }),
    );
    expect(hint).toContain('127.0.0.1:5432');
    expect(hint).toContain('pnpm infra:up');
  });

  it("parol noto'g'ri bo'lsa .env fayllarni tekshirishni aytadi", () => {
    const hint = dbErrorHint(
      adapterError({ kind: 'AuthenticationFailed', originalCode: '28P01', user: 'santexgo' }),
    );
    expect(hint).toContain('POSTGRES_PASSWORD');
    expect(hint).toContain('pnpm infra:reset');
  });

  it('baza nomi topilmasa nomini ko‘rsatadi', () => {
    expect(dbErrorHint(adapterError({ kind: 'DatabaseDoesNotExist', db: 'shop' }))).toContain(
      '"shop"',
    );
  });

  it('jadvallar yo‘q bo‘lsa migratsiyani eslatadi', () => {
    expect(dbErrorHint({ code: 'P2021', meta: { table: 'warehouses' } })).toContain(
      'pnpm db:deploy',
    );
  });

  it('notanish xatolar uchun null qaytaradi', () => {
    expect(dbErrorHint(new Error('boshqa xato'))).toBeNull();
    expect(dbErrorHint(null)).toBeNull();
    expect(dbErrorHint('matn')).toBeNull();
    expect(dbErrorHint(adapterError({ kind: 'UniqueConstraintViolation' }))).toBeNull();
  });
});
