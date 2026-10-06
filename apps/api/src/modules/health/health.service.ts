import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

const CHECK_TIMEOUT_MS = 3_000;

export interface DependencyStatus {
  status: 'up' | 'down';
  latencyMs?: number;
}

export interface HealthReport {
  status: 'ok' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: DependencyStatus;
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

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    const database = await this.checkDatabase();
    const report: HealthReport = {
      status: database.status === 'up' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database },
    };
    if (report.status !== 'ok') {
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
}
