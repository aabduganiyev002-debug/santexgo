import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CatalogCacheService } from '../catalog/catalog-cache.service.js';
import { PricingService } from './pricing.service.js';

/**
 * Chegirmalar o'z vaqtida boshlanishi va tugashi uchun: har daqiqada boshlanish yoki tugash
 * vaqti kelgan chegirma bormi — tekshiradi va bo'lsa narxlarni qayta hisoblaydi.
 * API ishga tushganda ham bir marta to'liq hisoblanadi (server o'chiq turgan vaqt uchun).
 */
@Injectable()
export class PricingSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PricingSchedulerService.name);
  private lastCheckAt = new Date();
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly cache: CatalogCacheService,
  ) {}

  onApplicationBootstrap(): void {
    // Ishga tushishni kutib turmaydi
    void this.run(async () => {
      const result = await this.pricing.recalculate();
      if (result.changedIds.length > 0) this.cache.invalidate();
    });
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'discount-schedule' })
  async tick(now: Date = new Date()): Promise<boolean> {
    let recalculated = false;
    await this.run(async () => {
      const since = this.lastCheckAt;
      const due = await this.prisma.discount.count({
        where: {
          OR: [{ startsAt: { gt: since, lte: now } }, { endsAt: { gt: since, lte: now } }],
        },
      });
      this.lastCheckAt = now;
      if (due === 0) return;
      const result = await this.pricing.recalculate(undefined, now);
      this.cache.invalidate();
      recalculated = true;
      this.logger.log(
        `Chegirmalar jadvali: ${due} ta chegirma boshlandi/tugadi, ${result.changedIds.length} ta narx o‘zgardi`,
      );
    });
    return recalculated;
  }

  private async run(job: () => Promise<void>): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await job();
    } catch (error) {
      this.logger.error(`Narxlarni hisoblashda xato: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
