import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CatalogCacheService } from './catalog-cache.service.js';
import { buildSearchText } from './search-text.js';

const SOURCE_SELECT = {
  id: true,
  name: true,
  sku: true,
  searchText: true,
  categoryId: true,
  brand: { select: { name: true } },
  material: { select: { name: true, fullName: true } },
  attributeValues: {
    select: {
      numberValue: true,
      textValue: true,
      booleanValue: true,
      attribute: { select: { unit: true, type: true } },
    },
  },
} satisfies Prisma.ProductSelect;

/** Qidiruv matnini yangilaydi: mahsulot, brend, kategoriya yoki material o'zgarganda. */
@Injectable()
export class SearchTextService {
  private readonly logger = new Logger(SearchTextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CatalogCacheService,
  ) {}

  async refresh(where: Prisma.ProductWhereInput): Promise<number> {
    const tree = await this.cache.categoryTree();
    const products = await this.prisma.product.findMany({ where, select: SOURCE_SELECT });
    let updated = 0;
    for (const product of products) {
      const text = buildSearchText({
        name: product.name,
        sku: product.sku,
        brand: product.brand.name,
        categories: tree.path(product.categoryId).map((c) => c.name),
        material: product.material,
        attributes: product.attributeValues
          .filter((v) => v.attribute.type !== 'BOOLEAN')
          .map((v) => ({
            unit: v.attribute.unit,
            value: v.numberValue !== null ? String(v.numberValue) : (v.textValue ?? ''),
          })),
      });
      if (text !== product.searchText) {
        await this.prisma.product.update({ where: { id: product.id }, data: { searchText: text } });
        updated += 1;
      }
    }
    if (updated > 10) this.logger.log(`Qidiruv matni yangilandi: ${updated} ta mahsulot`);
    return updated;
  }
}
