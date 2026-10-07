import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AUTH_COOKIES } from '@santexgo/shared';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Env } from './config/env.schema.js';
import { localStorageDir } from './infra/storage/storage.module.js';

/**
 * HTTP sozlamalari: xavfsizlik sarlavhalari, CORS, cookie, URL prefiksi, versiyalar, Swagger.
 * main.ts va e2e testlar uchun umumiy — testlar aynan production'dagi sozlamalar bilan ishlaydi.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Caddy / Next.js ortida mijozning haqiqiy IP manzilini olish uchun (rate limit shunga tayanadi)
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
    maxAge: 600,
  });
  // Lokal saqlashda yuklangan rasmlar API orqali beriladi (fayl nomlari tasodifiy — uzoq kesh)
  if (config.get('STORAGE_DRIVER', { infer: true }) === 'local') {
    app.useStaticAssets(localStorageDir(config), {
      prefix: '/api/media/',
      index: false,
      dotfiles: 'deny',
      fallthrough: true,
      immutable: true,
      maxAge: '365d',
    });
  }
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SantexGo API')
        .setDescription(
          'SantexGo online do‘koni va admin paneli uchun REST API.\n\n' +
            'Kirish: `POST /api/v1/auth/login` — tokenlar httpOnly cookie’ga yoziladi, ' +
            'keyingi so‘rovlar avtomatik autentifikatsiya qilinadi.',
        )
        .setVersion('1.0')
        .addCookieAuth(AUTH_COOKIES.access)
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs/openapi.json',
      swaggerOptions: { withCredentials: true, persistAuthorization: true },
    });
  }
}
