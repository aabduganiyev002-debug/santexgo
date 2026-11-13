import { Injectable } from '@nestjs/common';
import {
  SAMPLE_BRAND_SLUGS,
  SAMPLE_DISCOUNT_NAMES,
  SAMPLE_GROUP_NAMES,
  SAMPLE_PRODUCT_SKUS,
  type SampleDataRemoval,
  type SampleDataSummary,
} from '@santexgo/shared';
import type { ActorContext } from '../../../common/auth/decorators.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { CatalogCacheService } from '../../catalog/catalog-cache.service.js';
import { AdminDiscountsService } from '../discounts/admin-discounts.service.js';
import { AdminBrandsService } from './admin-brands.service.js';
import { AdminProductsService } from './admin-products.service.js';

/**
 * Seed'ning namunaviy ma'lumotlari (sinab ko'rish uchun): haqiqiy katalog yuklangach o'chiriladi.
 * Aks holda namunaviy chegirmalar (masalan, butun "Kanalizatsiya"ga −5%) haqiqiy mahsulotlarga ham tushadi.
 */
@Injectable()
export class AdminSampleDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: AdminProductsService,
    private readonly discounts: AdminDiscountsService,
    private readonly brands: AdminBrandsService,
    private readonly cache: CatalogCacheService,
    private readonly audit: AuditService,
  ) {}

  async summary(): Promise<SampleDataSummary> {
    const [products, discounts] = await Promise.all([
      this.prisma.product.count({
        where: { sku: { in: [...SAMPLE_PRODUCT_SKUS] }, isActive: true },
      }),
      this.prisma.discount.count({ where: { name: { in: [...SAMPLE_DISCOUNT_NAMES] } } }),
    ]);
    return { products, discounts };
  }

  async remove(actor: ActorContext): Promise<SampleDataRemoval> {
    // Avval chegirmalar — narxlar qayta hisoblanadi
    const discounts = await this.prisma.discount.findMany({
      where: { name: { in: [...SAMPLE_DISCOUNT_NAMES] } },
      select: { id: true },
    });
    for (const discount of discounts) await this.discounts.remove(discount.id, actor);

    // Buyurtmalarda bor mahsulot arxivlanadi (eski buyurtmalar buzilmasin), qolgani o'chiriladi
    const products = await this.prisma.product.findMany({
      where: { sku: { in: [...SAMPLE_PRODUCT_SKUS] } },
      select: { id: true },
    });
    let productsDeleted = 0;
    let productsArchived = 0;
    for (const product of products) {
      const { result } = await this.products.remove(product.id, actor);
      if (result === 'deleted') productsDeleted += 1;
      else productsArchived += 1;
    }

    await this.prisma.productGroup.deleteMany({
      where: { name: { in: [...SAMPLE_GROUP_NAMES] }, products: { none: {} } },
    });
    // Mahsulotsiz qolgan namunaviy brend o'chiriladi, arxivdagi mahsulotlari bo'lsa — yashiriladi
    const brands = await this.prisma.brand.findMany({
      where: { slug: { in: [...SAMPLE_BRAND_SLUGS] } },
      select: { id: true, _count: { select: { products: true } } },
    });
    for (const brand of brands) {
      if (brand._count.products === 0) {
        await this.brands.remove(brand.id, actor);
      } else {
        await this.prisma.brand.update({ where: { id: brand.id }, data: { isActive: false } });
      }
    }

    this.cache.invalidate();
    const result = { productsDeleted, productsArchived, discounts: discounts.length };
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'catalog.sample_data_delete',
      entityType: 'product',
      changes: result,
    });
    return result;
  }
}
