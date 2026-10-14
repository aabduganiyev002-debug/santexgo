import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CatalogCacheService } from '../catalog/catalog-cache.service.js';
import type { PriceResult } from '@santexgo/shared';
import { priceProduct, type PricingDiscount, type PricingProduct } from './pricing.calculator.js';

export interface RecalculateResult {
  checked: number;
  changedIds: string[];
}

/**
 * Narx moduli: amaldagi chegirmalar bo'yicha har bir mahsulotning joriy narxini
 * (products.current_price) hisoblaydi. Narx ekranda ham, buyurtmada ham shu qiymatdan olinadi.
 */
@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CatalogCacheService,
  ) {}

  /** Hozir amalda bo'lgan chegirmalar (faol, boshlangan, tugamagan). */
  async activeDiscounts(now: Date = new Date()): Promise<PricingDiscount[]> {
    return this.prisma.discount.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: {
        id: true,
        type: true,
        value: true,
        priority: true,
        targets: { select: { productId: true, categoryId: true, brandId: true } },
      },
    });
  }

  /** Bitta mahsulot narxi (saqlashdan oldin hisoblash uchun: yangi asosiy narx, brend, kategoriya). */
  async quote(product: PricingProduct, now: Date = new Date()): Promise<PriceResult> {
    const [discounts, tree] = await Promise.all([
      this.activeDiscounts(now),
      this.cache.categoryTree(),
    ]);
    return priceProduct(
      product,
      discounts,
      new Set(tree.path(product.categoryId).map((c) => c.id)),
    );
  }

  /** productIds berilmasa — barcha mahsulotlar. Faqat narxi o'zgarganlar yoziladi. */
  async recalculate(
    productIds?: readonly string[],
    now: Date = new Date(),
  ): Promise<RecalculateResult> {
    if (productIds && productIds.length === 0) return { checked: 0, changedIds: [] };
    const [discounts, tree, products] = await Promise.all([
      this.activeDiscounts(now),
      this.cache.categoryTree(),
      this.prisma.product.findMany({
        where: productIds ? { id: { in: [...productIds] } } : undefined,
        select: {
          id: true,
          brandId: true,
          categoryId: true,
          basePrice: true,
          currentPrice: true,
          appliedDiscountId: true,
        },
      }),
    ]);

    const updates = [];
    for (const product of products) {
      const path = new Set(tree.path(product.categoryId).map((c) => c.id));
      const price = priceProduct(product, discounts, path);
      if (
        price.finalPrice !== product.currentPrice ||
        price.discountId !== product.appliedDiscountId
      ) {
        updates.push({
          id: product.id,
          currentPrice: price.finalPrice,
          appliedDiscountId: price.discountId,
        });
      }
    }

    // Asosiy narx parallel o'zgargan bo'lsa ham CHECK buzilmasligi uchun shart bilan yoziladi
    for (const update of updates) {
      await this.prisma.product.updateMany({
        where: { id: update.id, basePrice: { gte: update.currentPrice } },
        data: { currentPrice: update.currentPrice, appliedDiscountId: update.appliedDiscountId },
      });
    }
    if (updates.length > 0) {
      this.logger.log(`Narxlar yangilandi: ${updates.length} ta mahsulot`);
    }
    return { checked: products.length, changedIds: updates.map((u) => u.id) };
  }
}
