import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.schema.js';
import { dbErrorHint } from './infra/prisma/db-error-hint.js';

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Production'da loglar JSON formatida — log yig'ish tizimlari uchun qulay
    logger: new ConsoleLogger({ prefix: 'SantexGo', json: isProduction, colors: !isProduction }),
  });
  configureApp(app);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const host = config.get('HOST', { infer: true });
  const port = config.get('PORT', { infer: true });
  await app.listen(port, host);
  Logger.log(`API ishga tushdi: http://${host}:${port}/api`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  // Tanish xatolar (baza ishlamayapti, parol noto'g'ri...) uchun uzun texnik matn o'rniga maslahat
  const hint = dbErrorHint(error);
  console.error('API ishga tushmadi:', hint ?? error);
  process.exit(1);
});
