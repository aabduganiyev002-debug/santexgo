import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RedisService } from '../../infra/redis/redis.service.js';

const CHECK_TIMEOUT_MS = 3_000;

export interface DependencyStatus {
  status: 'up' | 'down' | 'disabled';
  latencyMs?: number;
}

export interface HealthReport {
  /** degraded — asosiy funksiyalar ishlaydi, lekin yordamchi xizmat (Redis) ishlamayapti */
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const status = database.status !== 'up' ? 'error' : redis.status === 'down' ? 'degraded' : 'ok';
    const report: HealthReport = {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, redis },
    };
    // Baza ishlamasa — 503 (konteyner qayta ishga tushiriladi); Redis ishlamasa API baribir ishlaydi
    if (report.status === 'error') {
      throw new ServiceUnavailableException(report);
    }
    return report;
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    const startedAt = performance.now();
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS);
      return { status: 'up', latencyMs: Math.round(performance.now() - startedAt) };
    } catch (error) {
      // Tafsilotlar faqat logga yoziladi, javobda ichki ma'lumot oshkor qilinmaydi
      this.logger.error(`Baza tekshiruvi muvaffaqiyatsiz: ${(error as Error).message}`);
      return { status: 'down' };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    if (!this.redis.client) return { status: 'disabled' };
    const startedAt = performance.now();
    const ok = await withTimeout(this.redis.ping(), CHECK_TIMEOUT_MS).catch(() => false);
    return ok
      ? { status: 'up', latencyMs: Math.round(performance.now() - startedAt) }
      : { status: 'down' };
  }
}
