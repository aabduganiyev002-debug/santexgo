import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Tugagan sessiyalar yana shuncha kun saqlanadi (xavfsizlik tekshiruvlari uchun) */
const SESSION_RETENTION_DAYS = 30;
const CODE_RETENTION_DAYS = 7;

/** Har kuni tunda eskirgan sessiyalar va SMS kodlarni bazadan tozalaydi. */
@Injectable()
export class AuthMaintenanceService {
  private readonly logger = new Logger(AuthMaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 03:20 (Toshkent vaqti)
  @Cron('20 3 * * *', { name: 'auth-cleanup', timeZone: 'Asia/Tashkent' })
  async cleanup(now: Date = new Date()): Promise<{ sessions: number; codes: number }> {
    const sessionCutoff = new Date(now.getTime() - SESSION_RETENTION_DAYS * DAY_MS);
    const codeCutoff = new Date(now.getTime() - CODE_RETENTION_DAYS * DAY_MS);
    const [sessions, codes] = await Promise.all([
      this.prisma.session.deleteMany({
        where: { OR: [{ expiresAt: { lt: sessionCutoff } }, { revokedAt: { lt: sessionCutoff } }] },
      }),
      this.prisma.verificationCode.deleteMany({ where: { createdAt: { lt: codeCutoff } } }),
    ]);
    if (sessions.count || codes.count) {
      this.logger.log(`Tozalandi: ${sessions.count} sessiya, ${codes.count} SMS kod`);
    }
    return { sessions: sessions.count, codes: codes.count };
  }
}
