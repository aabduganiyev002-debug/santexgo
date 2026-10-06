import { defineConfig } from 'prisma/config';

// Prisma 7 .env faylini o'zi yuklamaydi. Fayl bo'lmasa, o'zgaruvchilar muhitdan olinadi.
try {
  process.loadEnvFile();
} catch {
  // .env yo'q (masalan, production yoki CI) — bu normal holat
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // `prisma generate` bazasiz ham ishlashi uchun env() emas, process.env ishlatiladi.
  // Migratsiya buyruqlari DATABASE_URL bo'lmasa aniq xato bilan to'xtaydi.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
