import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware.js';
import { validateEnv } from './config/env.schema.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { RateLimitModule } from './infra/rate-limit/rate-limit.module.js';
import { ThrottlerStorageAdapter } from './infra/rate-limit/throttler-storage.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { SmsModule } from './infra/sms/sms.module.js';
import { StorageModule } from './infra/storage/storage.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuthGuard } from './modules/auth/guards/auth.guard.js';
import { CsrfGuard } from './modules/auth/guards/csrf.guard.js';
import { RolesGuard } from './modules/auth/guards/roles.guard.js';
import { CatalogCoreModule } from './modules/catalog/catalog-core.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { PricingModule } from './modules/pricing/pricing.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    RateLimitModule,
    // Barcha API uchun IP bo'yicha umumiy limit; auth manzillarida qattiqroq (@Throttle)
    ThrottlerModule.forRootAsync({
      inject: [ThrottlerStorageAdapter],
      useFactory: (storage: ThrottlerStorageAdapter) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
        storage,
      }),
    }),
    SmsModule,
    StorageModule,
    AuditModule,
    HealthModule,
    AuthModule,
    CatalogCoreModule,
    PricingModule,
    InventoryModule,
    CatalogModule,
    ContentModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Tartib muhim: CSRF → rate limit → autentifikatsiya → rol
    { provide: APP_GUARD, useExisting: CsrfGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*splat}');
  }
}
