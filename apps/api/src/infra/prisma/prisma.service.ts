import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../../config/env.schema.js';
import { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Butun ilova uchun yagona Prisma client (PostgreSQL, pg driver adapter orqali).
 * Barcha so'rovlar parametrlangan — SQL injection'dan himoyalangan.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
        max: config.get('DATABASE_POOL_SIZE', { infer: true }),
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 30_000,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    // Baza mavjud bo'lmasa, API ishga tushmaydi (konteyner qayta ishga tushiriladi).
    // Xatoga tushunarli maslahat main.ts da qo'shiladi (dbErrorHint).
    await this.$queryRaw`SELECT 1`;
    this.logger.log('PostgreSQL bilan ulanish tayyor');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
