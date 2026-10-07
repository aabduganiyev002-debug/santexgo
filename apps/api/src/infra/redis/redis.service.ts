import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../../config/env.schema.js';

const CONNECT_TIMEOUT_MS = 2_000;
const ERROR_LOG_INTERVAL_MS = 60_000;

/**
 * Ixtiyoriy Redis ulanishi. REDIS_URL berilmasa yoki Redis ishlamasa, API to'xtamaydi —
 * unga tayanadigan xizmatlar (rate limit) vaqtincha xotiradan foydalanadi.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private lastErrorLoggedAt = 0;
  readonly client: Redis | null;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('REDIS_URL', { infer: true });
    this.client = url
      ? new Redis(url, {
          lazyConnect: true,
          connectTimeout: CONNECT_TIMEOUT_MS,
          // Ulanish yo'q bo'lsa buyruqlar navbatda kutmaydi — darhol xato (va zaxira yo'l)
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => Math.min(times * 500, 5_000),
          keyPrefix: 'sg:',
        })
      : null;
    this.client?.on('error', (error: Error) => this.logError(error));
  }

  get isReady(): boolean {
    return this.client?.status === 'ready';
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      this.logger.warn('REDIS_URL berilmagan — rate limit xotirada saqlanadi');
      return;
    }
    try {
      await this.client.connect();
      this.logger.log('Redis bilan ulanish tayyor');
    } catch (error) {
      this.logError(error as Error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client && this.client.status !== 'end') {
      await this.client.quit().catch(() => this.client?.disconnect());
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  /** Bir xil xato loglarni to'ldirib yubormasligi uchun daqiqasiga bir marta yoziladi. */
  logError(error: Error): void {
    const now = Date.now();
    if (now - this.lastErrorLoggedAt < ERROR_LOG_INTERVAL_MS) return;
    this.lastErrorLoggedAt = now;
    this.logger.error(`Redis xatosi: ${error.message}`);
  }
}
