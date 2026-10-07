import { Injectable } from '@nestjs/common';
import {
  type AttributeFacet,
  type CategoryFacet,
  CATALOG_QUERY_KEYS,
  type FacetValue,
  type ProductCard,
  type ProductFacets,
  type ProductListQuery,
  type ProductListResponse,
  type ProductSort,
  searchTokens,
} from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CatalogCacheService } from './catalog-cache.service.js';
import { CategoryPresenter } from './category.presenter.js';
import type { CategoryRecord } from './category-tree.js';
import { CARD_SELECT, ProductCardMapper } from './product-card.mapper.js';
import {
  type AttributeFilter,
  buildOrderBy,
  buildWhere,
  type FacetGroup,
  PRODUCT_FROM,
  type ResolvedFilters,
} from './product-filters.js';
import { TtlCache } from './ttl-cache.js';

const RESERVED = new Set<string>(CATALOG_QUERY_KEYS);
const TRUE_VALUES = new Set(['1', 'true', 'ha', 'yes']);
const FALSE_VALUES = new Set(['0', 'false', "yo'q", 'yoq', 'no']);

interface FacetRow {
  value: string;
  label: string;
  count: number;
}

interface AttributeFacetRow {
  attributeId: string;
  numberValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
  count: number;
}

export interface ListOptions {
  /** Facet sonlari kerak emas (bosh sahifa bloklari, o'xshash mahsulotlar) */
  withFacets?: boolean;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

/**
 * Katalog: filtrlar (brend + material + kategoriya + xususiyatlar + narx + mavjudlik + qidiruv),
 * saralash, sahifalash va har bir filtr qiymati yonidagi mahsulotlar soni (facets).
 * Barcha so'rovlar parametrlangan (SQL injection'dan himoyalangan).
 */
@Injectable()
export class ProductQueryService {
  /** Bir xil filtrlar uchun facet natijalari qisqa muddat keshlanadi (sahifa almashganda qayta hisoblanmaydi) */
  private readonly facetCache = new TtlCache<ProductFacets>(500, 30_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CatalogCacheService,
    private readonly cards: ProductCardMapper,
    private readonly categories: CategoryPresenter,
  ) {
    cache.onInvalidate(() => this.facetCache.clear());
  }

  async list(query: ProductListQuery, options: ListOptions = {}): Promise<ProductListResponse> {
    const { withFacets = true } = options;
    const { filters, category } = await this.resolve(query);
    const sort: ProductSort = query.sort ?? (filters.tokens.length > 0 ? 'relevance' : 'popular');

    let page = await this.findPage(filters, sort, query.page, query.pageSize);
    // Aniq natija yo'q — xato yozilgan bo'lishi mumkin: o'xshash so'zlar bilan qayta qidiramiz
    if (page.total === 0 && filters.tokens.length > 0) {
      filters.fuzzy = true;
      page = await this.findPage(filters, sort, query.page, query.pageSize);
    }

    const [items, facets, categoryDetail] = await Promise.all([
      this.loadCards(page.ids),
      withFacets ? this.facets(filters, query) : Promise.resolve(emptyFacets()),
      category ? this.categories.detail(category) : Promise.resolve(null),
    ]);

    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: page.total,
      totalPages: Math.max(1, Math.ceil(page.total / query.pageSize)),
      facets,
      category: categoryDetail,
    };
  }

  /** ID'lar tartibida mahsulot kartochkalari. */
  async loadCards(ids: readonly string[]): Promise<ProductCard[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.product.findMany({
      where: { id: { in: [...ids] } },
      select: CARD_SELECT,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const now = Date.now();
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [this.cards.toCard(row, now)] : [];
    });
  }

  // ─────────────────────────────── Filtrlar ───────────────────────────────

  private async resolve(
    query: ProductListQuery,
  ): Promise<{ filters: ResolvedFilters; category: CategoryRecord | null }> {
    const [tree, attributes] = await Promise.all([
      this.cache.categoryTree(),
      this.cache.attributes(),
    ]);

    let category: CategoryRecord | null = null;
    let categoryIds: string[] | null = null;
    if (query.category) {
      category = tree.bySlug.get(query.category) ?? null;
      if (!category || !tree.isVisible(category.id)) {
        throw ApiError.notFound('Kategoriya topilmadi');
      }
      categoryIds = tree.descendantIds(category.id);
    }

    const attributeFilters: AttributeFilter[] = [];
    for (const attribute of attributes) {
      if (!attribute.isFilterable || RESERVED.has(attribute.key)) continue;
      const raw = (query as Record<string, unknown>)[attribute.key];
      if (!Array.isArray(raw) || raw.length === 0) continue;
      const values = raw as string[];
      const filter: AttributeFilter = { attribute, numbers: [], texts: [], booleans: [] };
      if (attribute.type === 'NUMBER') {
        filter.numbers = values.map(Number).filter((n) => Number.isFinite(n));
      } else if (attribute.type === 'TEXT') {
        filter.texts = values;
      } else {
        filter.booleans = values
          .map((v) => v.toLowerCase())
          .flatMap((v) => (TRUE_VALUES.has(v) ? [true] : FALSE_VALUES.has(v) ? [false] : []));
      }
      if (filter.numbers.length + filter.texts.length + filter.booleans.length > 0) {
        attributeFilters.push(filter);
      }
    }

    let { priceMin, priceMax } = query;
    if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
      [priceMin, priceMax] = [priceMax, priceMin];
    }

    return {
      category,
      filters: {
        brandSlugs: query.brand ?? [],
        materialSlugs: query.material ?? [],
        categoryId: category?.id ?? null,
        categoryIds,
        attributes: attributeFilters,
        priceMin,
        priceMax,
        inStock: query.inStock ?? false,
        onSale: query.onSale ?? false,
        tokens: query.q ? searchTokens(query.q) : [],
        fuzzy: false,
      },
    };
  }

  private async findPage(
    filters: ResolvedFilters,
    sort: ProductSort,
    page: number,
    pageSize: number,
  ): Promise<{ ids: string[]; total: number }> {
    const where = buildWhere(filters);
    const rows = await this.prisma.$queryRaw<{ id: string; total: number }[]>`
      SELECT p.id, COUNT(*) OVER()::int AS total
      FROM ${PRODUCT_FROM}
      WHERE ${where}
      ORDER BY ${buildOrderBy(sort, filters)}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
    if (rows.length > 0) return { ids: rows.map((r) => r.id), total: rows[0]!.total };
    if (page === 1) return { ids: [], total: 0 };
    // Sahifa raqami natijalar sonidan katta — umumiy sonni alohida hisoblaymiz
    const [count] = await this.prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM ${PRODUCT_FROM} WHERE ${where}`;
    return { ids: [], total: count?.total ?? 0 };
  }

  // ─────────────────────────────── Facets ───────────────────────────────

  private async facets(filters: ResolvedFilters, query: ProductListQuery): Promise<ProductFacets> {
    const key = JSON.stringify({ ...filters, page: undefined });
    const cached = this.facetCache.get(key);
    if (cached) return cached;
    const facets = await this.computeFacets(filters, query);
    this.facetCache.set(key, facets);
    return facets;
  }

  private async computeFacets(
    filters: ResolvedFilters,
    query: ProductListQuery,
  ): Promise<ProductFacets> {
    const [brands, materials, categories, attributes, price, flags] = await Promise.all([
      this.prisma.$queryRaw<FacetRow[]>`
        SELECT b.slug AS value, b.name AS label, COUNT(*)::int AS count
        FROM ${PRODUCT_FROM}
        WHERE ${buildWhere(filters, 'brand')}
        GROUP BY b.id, b.slug, b.name, b.sort_order
        ORDER BY b.sort_order, b.name`,
      this.prisma.$queryRaw<FacetRow[]>`
        SELECT m.slug AS value, m.name AS label, COUNT(*)::int AS count
        FROM ${PRODUCT_FROM}
        WHERE ${buildWhere(filters, 'material')} AND m.id IS NOT NULL AND m.is_active
        GROUP BY m.id, m.slug, m.name, m.sort_order
        ORDER BY m.sort_order, m.name`,
      this.categoryFacet(filters),
      this.attributeFacets(filters),
      this.prisma.$queryRaw<{ min: number | null; max: number | null }[]>`
        SELECT MIN(p.current_price)::int AS min, MAX(p.current_price)::int AS max
        FROM ${PRODUCT_FROM}
        WHERE ${buildWhere(filters, 'price')}`,
      this.prisma.$queryRaw<{ inStock: number; onSale: number }[]>`
        SELECT COUNT(*) FILTER (WHERE p.available_stock > 0)::int AS "inStock",
               COUNT(*) FILTER (WHERE p.current_price < p.base_price)::int AS "onSale"
        FROM ${PRODUCT_FROM}
        WHERE ${buildWhere(filters, 'flags')}`,
    ]);

    const priceRow = price[0];
    return {
      brands: withSelected(brands, query.brand ?? []),
      materials: withSelected(materials, query.material ?? []),
      categories,
      attributes,
      price:
        priceRow && priceRow.min !== null && priceRow.max !== null
          ? { min: priceRow.min, max: priceRow.max }
          : null,
      inStockCount: flags[0]?.inStock ?? 0,
      onSaleCount: flags[0]?.onSale ?? 0,
    };
  }

  /** Tanlangan kategoriyaning bevosita ichki kategoriyalari (yoki asosiylari) — sonlari bilan. */
  private async categoryFacet(filters: ResolvedFilters): Promise<CategoryFacet[]> {
    const [tree, rows] = await Promise.all([
      this.cache.categoryTree(),
      this.prisma.$queryRaw<{ categoryId: string; count: number }[]>`
        SELECT p.category_id AS "categoryId", COUNT(*)::int AS count
        FROM ${PRODUCT_FROM}
        WHERE ${buildWhere(filters, 'category')}
        GROUP BY p.category_id`,
    ]);
    const totals = tree.rollUp(new Map(rows.map((r) => [r.categoryId, r.count])));
    const parentId = filters.categoryId;
    return tree
      .children(parentId)
      .map((c) => ({ slug: c.slug, name: c.name, count: totals.get(c.id) ?? 0 }))
      .filter((c) => c.count > 0);
  }

  private async attributeFacets(filters: ResolvedFilters): Promise<AttributeFacet[]> {
    const attributes = (await this.cache.attributes()).filter(
      (a) => a.isFilterable && !RESERVED.has(a.key),
    );
    if (attributes.length === 0) return [];
    const selectedIds = new Set(filters.attributes.map((f) => f.attribute.id));

    const query = (where: Prisma.Sql, attributeIds: string[]) =>
      this.prisma.$queryRaw<AttributeFacetRow[]>`
        SELECT v.attribute_id AS "attributeId", v.number_value AS "numberValue",
               v.text_value AS "textValue", v.boolean_value AS "booleanValue",
               COUNT(DISTINCT p.id)::int AS count
        FROM ${PRODUCT_FROM}
        JOIN product_attribute_values v ON v.product_id = p.id
        WHERE ${where} AND v.attribute_id = ANY(${attributeIds}::uuid[])
        GROUP BY v.attribute_id, v.number_value, v.text_value, v.boolean_value`;

    // Tanlanmagan xususiyatlar — bitta so'rovda; tanlanganlari — o'z filtrisiz (OR mantiq)
    const unselected = attributes.filter((a) => !selectedIds.has(a.id)).map((a) => a.id);
    const results = await Promise.all([
      unselected.length > 0 ? query(buildWhere(filters), unselected) : Promise.resolve([]),
      ...[...selectedIds].map((id) => query(buildWhere(filters, `attr:${id}` as FacetGroup), [id])),
    ]);
    const rows = results.flat();

    return attributes
      .map((attribute): AttributeFacet => {
        const filter = filters.attributes.find((f) => f.attribute.id === attribute.id);
        const values = rows
          .filter((r) => r.attributeId === attribute.id)
          .map((r): FacetValue & { sortKey: number | string } => {
            if (r.numberValue !== null) {
              return {
                value: formatNumber(r.numberValue),
                label: formatNumber(r.numberValue),
                count: r.count,
                selected: filter?.numbers.includes(r.numberValue) ?? false,
                sortKey: r.numberValue,
              };
            }
            if (r.booleanValue !== null) {
              return {
                value: String(r.booleanValue),
                label: r.booleanValue ? 'Ha' : 'Yo‘q',
                count: r.count,
                selected: filter?.booleans.includes(r.booleanValue) ?? false,
                sortKey: r.booleanValue ? 0 : 1,
              };
            }
            const text = r.textValue ?? '';
            return {
              value: text,
              label: text,
              count: r.count,
              selected: filter?.texts.some((t) => t.toLowerCase() === text.toLowerCase()) ?? false,
              sortKey: text,
            };
          })
          .sort((a, b) =>
            typeof a.sortKey === 'number' && typeof b.sortKey === 'number'
              ? a.sortKey - b.sortKey
              : String(a.sortKey).localeCompare(String(b.sortKey), 'uz', { numeric: true }),
          )
          .map(({ sortKey: _sortKey, ...value }) => value);
        return {
          key: attribute.key,
          name: attribute.name,
          unit: attribute.unit,
          type: attribute.type,
          values,
        };
      })
      .filter((facet) => facet.values.length > 0);
  }
}

function withSelected(rows: FacetRow[], selected: readonly string[]): FacetValue[] {
  const values: FacetValue[] = rows.map((row) => ({
    value: row.value,
    label: row.label,
    count: row.count,
    selected: selected.includes(row.value),
  }));
  // Tanlangan, lekin hozir 0 natijali qiymat ham ko'rinsin — mijoz uni bekor qila olsin
  for (const value of selected) {
    if (!values.some((v) => v.value === value)) {
      values.push({ value, label: value, count: 0, selected: true });
    }
  }
  return values;
}

function emptyFacets(): ProductFacets {
  return {
    brands: [],
    materials: [],
    categories: [],
    attributes: [],
    price: null,
    inStockCount: 0,
    onSaleCount: 0,
  };
}
