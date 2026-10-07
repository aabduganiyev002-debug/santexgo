import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CategoryTree } from './category-tree.js';

const TTL_MS = 60_000;

/** Faol mahsulotlar soni brend × kategoriya × material kesimida (bitta yengil so'rov). */
export interface CatalogStatsRow {
  brandId: string;
  categoryId: string;
  materialId: string | null;
  count: number;
}

export class CatalogStats {
  constructor(readonly rows: readonly CatalogStatsRow[]) {}

  count(filter: {
    brandId?: string | null;
    categoryIds?: ReadonlySet<string> | null;
    materialId?: string | null;
  }): number {
    let total = 0;
    for (const row of this.rows) {
      if (filter.brandId && row.brandId !== filter.brandId) continue;
      if (filter.materialId && row.materialId !== filter.materialId) continue;
      if (filter.categoryIds && !filter.categoryIds.has(row.categoryId)) continue;
      total += row.count;
    }
    return total;
  }

  countBy(key: 'brandId' | 'categoryId' | 'materialId'): Map<string, number> {
    const result = new Map<string, number>();
    for (const row of this.rows) {
      const id = row[key];
      if (id) result.set(id, (result.get(id) ?? 0) + row.count);
    }
    return result;
  }
}

export interface AttributeRecord {
  id: string;
  key: string;
  name: string;
  unit: string | null;
  type: 'NUMBER' | 'TEXT' | 'BOOLEAN';
  isFilterable: boolean;
  isVisible: boolean;
  sortOrder: number;
}

interface Cached<T> {
  value: Promise<T>;
  expiresAt: number;
}

/**
 * Kam o'zgaradigan katalog ma'lumotlari keshi: kategoriyalar daraxti va mahsulot sonlari.
 * Admin o'zgartirganda darhol yangilanadi (invalidate), boshqa API nusxalarida — 1 daqiqada.
 */
@Injectable()
export class CatalogCacheService {
  private tree: Cached<CategoryTree> | null = null;
  private stats: Cached<CatalogStats> | null = null;
  private attributeList: Cached<AttributeRecord[]> | null = null;
  private readonly listeners: Array<() => void> = [];

  constructor(private readonly prisma: PrismaService) {}

  categoryTree(): Promise<CategoryTree> {
    if (!this.tree || this.tree.expiresAt <= Date.now()) {
      const entry: Cached<CategoryTree> = {
        value: this.loadTree(),
        expiresAt: Date.now() + TTL_MS,
      };
      // Xato bo'lsa keshda qolmasin — keyingi so'rov qayta urinadi
      entry.value.catch(() => {
        if (this.tree === entry) this.tree = null;
      });
      this.tree = entry;
    }
    return this.tree.value;
  }

  catalogStats(): Promise<CatalogStats> {
    if (!this.stats || this.stats.expiresAt <= Date.now()) {
      const entry: Cached<CatalogStats> = {
        value: this.loadStats(),
        expiresAt: Date.now() + TTL_MS,
      };
      entry.value.catch(() => {
        if (this.stats === entry) this.stats = null;
      });
      this.stats = entry;
    }
    return this.stats.value;
  }

  attributes(): Promise<AttributeRecord[]> {
    if (!this.attributeList || this.attributeList.expiresAt <= Date.now()) {
      const entry: Cached<AttributeRecord[]> = {
        value: this.prisma.attribute.findMany({
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            key: true,
            name: true,
            unit: true,
            type: true,
            isFilterable: true,
            isVisible: true,
            sortOrder: true,
          },
        }),
        expiresAt: Date.now() + TTL_MS,
      };
      entry.value.catch(() => {
        if (this.attributeList === entry) this.attributeList = null;
      });
      this.attributeList = entry;
    }
    return this.attributeList.value;
  }

  /** Katalog o'zgarganda boshqa keshlar ham tozalanishi uchun (bosh sahifa, filtr sonlari). */
  onInvalidate(listener: () => void): void {
    this.listeners.push(listener);
  }

  invalidate(): void {
    this.tree = null;
    this.stats = null;
    this.attributeList = null;
    for (const listener of this.listeners) listener();
  }

  private async loadTree(): Promise<CategoryTree> {
    const records = await this.prisma.category.findMany({
      select: {
        id: true,
        parentId: true,
        slug: true,
        name: true,
        description: true,
        imageUrl: true,
        sortOrder: true,
        isActive: true,
      },
    });
    return new CategoryTree(records);
  }

  private async loadStats(): Promise<CatalogStats> {
    const rows = await this.prisma.$queryRaw<CatalogStatsRow[]>`
      SELECT p.brand_id AS "brandId", p.category_id AS "categoryId",
             p.material_id AS "materialId", COUNT(*)::int AS count
      FROM products p
      JOIN brands b ON b.id = p.brand_id AND b.is_active
      JOIN categories c ON c.id = p.category_id AND c.is_active
      WHERE p.is_active
      GROUP BY p.brand_id, p.category_id, p.material_id
    `;
    return new CatalogStats(rows);
  }
}
