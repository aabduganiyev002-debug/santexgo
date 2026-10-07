/**
 * E2E testlar uchun muhit. Baza manzili DATABASE_URL dan olinadi (CI'da toza baza).
 * Lokal kompyuterda: apps/api/.env dagi baza ishlatiladi; testlar o'zi yaratgan
 * foydalanuvchilarni oxirida o'chiradi.
 */
try {
  process.loadEnvFile();
} catch {
  // .env yo'q (CI) — muhit o'zgaruvchilari ishlatiladi
}

if (!process.env.DATABASE_URL) {
  throw new Error('E2E testlar uchun DATABASE_URL berilishi kerak');
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  AUTH_SECRET: 'e2e-test-secret-e2e-test-secret-e2e-test-secret',
  SMS_PROVIDER: 'console',
  SWAGGER_ENABLED: 'false',
  CORS_ORIGINS: 'http://localhost:3000',
  // Rate limit hisoblagichlari har test ishga tushganda toza bo'lishi uchun xotirada
  REDIS_URL: '',
});
