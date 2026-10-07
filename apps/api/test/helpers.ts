import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import supertest from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/common/security/password.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { ConsoleSmsSender } from '../src/infra/sms/console-sms.sender.js';
import { SmsSender } from '../src/infra/sms/sms-sender.js';

export interface TestContext {
  app: INestApplication;
  http: ReturnType<typeof supertest>;
  prisma: PrismaService;
  sms: ConsoleSmsSender;
  /** Test oxirida o'chiriladigan telefon raqamlari */
  phones: Set<string>;
}

export async function createTestApp(): Promise<TestContext> {
  const sms = new ConsoleSmsSender();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SmsSender)
    .useValue(sms)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
  configureApp(app);
  await app.init();
  return {
    app,
    http: supertest(app.getHttpServer()),
    prisma: app.get(PrismaService),
    sms,
    phones: new Set(),
  };
}

export async function closeTestApp(ctx: TestContext): Promise<void> {
  const phones = [...ctx.phones];
  if (phones.length > 0) {
    await ctx.prisma.verificationCode.deleteMany({ where: { phone: { in: phones } } });
    await ctx.prisma.user.deleteMany({ where: { phone: { in: phones } } });
  }
  await ctx.app.close();
}

/** Har safar yangi (bazada bo'lmagan) test raqami: +99899XXXXXXX */
export function randomPhone(ctx: TestContext): string {
  const phone = `+99899${randomInt(1_000_000, 9_999_999)}`;
  ctx.phones.add(phone);
  return phone;
}

/** Konsol SMS provayderiga yuborilgan oxirgi 6 xonali kod. */
export function lastCode(ctx: TestContext, phone: string): string {
  const message = ctx.sms.lastMessageTo(phone);
  const code = message?.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`${phone} raqamiga kod yuborilmagan`);
  return code;
}

/** Set-Cookie sarlavhalaridan cookie qiymatini oladi. */
export function cookieValue(setCookie: string[] | string | undefined, name: string): string | null {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const cookie of list) {
    const [pair] = cookie.split(';');
    const [key, ...value] = (pair ?? '').split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

export const VALID_PASSWORD = 'Parol12345';

/** Bazada admin yaratib, u bilan kirgan agent (cookie'lar ichida). */
export async function createAdminAgent(ctx: TestContext) {
  const phone = randomPhone(ctx);
  await ctx.prisma.user.create({
    data: {
      firstName: 'E2E',
      lastName: 'Admin',
      phone,
      passwordHash: await hashPassword(VALID_PASSWORD),
      role: 'ADMIN',
      phoneVerifiedAt: new Date(),
    },
  });
  const agent = supertest.agent(ctx.app.getHttpServer());
  await agent.post('/api/v1/auth/login').send({ phone, password: VALID_PASSWORD }).expect(200);
  return agent;
}

/** Testlar bir-biriga xalaqit bermasligi uchun nomlarga qo'shiladigan tasodifiy qism. */
export function uniqueSuffix(): string {
  return randomInt(100_000, 999_999).toString();
}
