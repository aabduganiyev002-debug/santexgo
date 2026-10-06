import 'reflect-metadata';
import { ConsoleLogger, Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.schema.js';
import { dbErrorHint } from './infra/prisma/db-error-hint.js';

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Production'da loglar JSON formatida — log yig'ish tizimlari uchun qulay
    logger: new ConsoleLogger({ prefix: 'SantexGo', json: isProduction, colors: !isProduction }),
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Caddy/Nginx ortida mijozning haqiqiy IP manzilini olish uchun (rate limit shunga tayanadi)
  app.set('trust proxy', 1);
  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
    maxAge: 600,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SantexGo API')
        .setDescription('SantexGo online do‘koni va admin paneli uchun REST API')
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs/openapi.json',
    });
  }

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
