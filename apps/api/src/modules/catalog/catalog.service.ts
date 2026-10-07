import { Injectable } from '@nestjs/common';
import {
  type BannerInfo,
  type BrandDetail,
  type BrandSummary,
  type CategoryDetail,
  type CategoryNode,
  type CollectionSummary,
  type HomePageData,
  type MaterialSummary,
  normalizeSearchText,
  type ProductAttribute,
  type ProductCard,
  type ProductDetail,
  productListQuerySchema,
  type ProductSort,
  type ProductVariant,
  type SearchSuggestions,
  searchTokens,
  type SitemapData,
} from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { MediaService } from '../../infra/storage/media.service.js';
import { CatalogCacheService, type CatalogStats } from './catalog-cache.service.js';
import { CategoryPresenter } from './category.presenter.js';
import type { CategoryTree } from './category-tree.js';
import {
  CARD_SELECT,
  IMAGE_ORDER,
  IMAGE_SELECT,
  ProductCardMapper,
} from './product-card.mapper.js';
import { ProductQueryService } from './product-query.service.js';
import { TtlCache } from './ttl-cache.js';

const HOME_BLOCK_SIZE = 12;
const SIMILAR_LIMIT = 8;

const DETAIL_SELECT = {
  ...CARD_SELECT,
  isActive: true,
  shortDescription: true,
  description: true,
  weightGrams: true,
  warrantyMonths: true,
  metaTitle: true,
  metaDescription: true,
  categoryId: true,
  materialId: true,
  groupId: true,
  brand: { select: { slug: true, name: true, isActive: true } },
  material: { select: { slug: true, name: true, fullName: true } },
  images: { select: IMAGE_SELECT, orderBy: IMAGE_ORDER },
  documents: { select: { type: true, title: true, url: true }, orderBy: { sortOrder: 'asc' } },
  attributeValues: {
    select: {
      numberValue: true,
      textValue: true,
      booleanValue: true,
      attribute: {
        select: { key: true, name: true, unit: true, isVisible: true, sortOrder: true },
      },
    },
  },
  group: { select: { variantAttributeKey: true } },
} satisfies Prisma.ProductSelect;

type AttributeValueRow = {
  numberValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
};

function formatValue(value: AttributeValueRow): string {
  if (value.numberValue !== null) {
    return Number.isInteger(value.numberValue)
      ? String(value.numberValue)
      : String(Number(value.numberValue.toFixed(3)));
  }
  if (value.booleanValue !== null) return value.booleanValue ? 'Ha' : 'Yo‘q';
  return value.textValue ?? '';
}

/** Variant tugmasidagi yozuv: diametr uchun "Ø25", boshqalar uchun qiymat va birlik. */
function variantLabel(key: string, unit: string | null, value: AttributeValueRow): string {
  const text = formatValue(value);
  if (key.startsWith('diameter') && value.numberValue !== null) return `Ø${text}`;
  return unit && value.numberValue !== null ? `${text} ${unit}` : text;
}

/** Sayt uchun katalog ma'lumotlari (faqat faol va ko'rinadigan yozuvlar). */
@Injectable()
export class CatalogService {
  private readonly homeCache = new TtlCache<HomePageData>(1, 60_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CatalogCacheService,
    private readonly media: MediaService,
    private readonly cards: ProductCardMapper,
    private readonly categories: CategoryPresenter,
    private readonly products: ProductQueryService,
  ) {
    cache.onInvalidate(() => this.homeCache.clear());
  }

  // ─────────────────────────────── Bosh sahifa ───────────────────────────────

  async home(): Promise<HomePageData> {
    const cached = this.homeCache.get('home');
    if (cached) return cached;

    const block = (query: { onSale?: boolean; sort: ProductSort }) =>
      this.products
        .list(
          productListQuerySchema.parse({
            page: 1,
            pageSize: HOME_BLOCK_SIZE,
            inStock: true,
            ...query,
          }),
          { withFacets: false },
        )
        .then((result) => result.items);

    const [banners, brands, collections, categories, sale, newArrivals, bestSellers] =
      await Promise.all([
        this.banners(),
        this.brands({ featuredFirst: true }),
        this.collections(),
        this.categories.tree({ hideEmpty: true }),
        block({ onSale: true, sort: 'discount' }),
        block({ sort: 'new' }),
        block({ sort: 'popular' }),
      ]);

    const data: HomePageData = {
      banners,
      brands,
      collections,
      categories,
      sale,
      newArrivals,
      bestSellers,
    };
    this.homeCache.set('home', data);
    return data;
  }

  private async banners(now: Date = new Date()): Promise<BannerInfo[]> {
    const rows = await this.prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map((b) => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      imageUrl: this.media.url(b.imageUrl),
      mobileImageUrl: this.media.urlOrNull(b.mobileImageUrl),
      linkUrl: b.linkUrl,
    }));
  }

  // ─────────────────────────────── Brendlar ───────────────────────────────

  async brands(options: { featuredFirst?: boolean } = {}): Promise<BrandSummary[]> {
    const [rows, stats] = await Promise.all([
      this.prisma.brand.findMany({
        where: { isActive: true },
        orderBy: [
          ...(options.featuredFirst ? [{ isFeatured: 'desc' as const }] : []),
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        select: { id: true, slug: true, name: true, logoUrl: true },
      }),
      this.cache.catalogStats(),
    ]);
    const counts = stats.countBy('brandId');
    return rows.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      logoUrl: this.media.urlOrNull(b.logoUrl),
      productCount: counts.get(b.id) ?? 0,
    }));
  }

  async brand(slug: string): Promise<BrandDetail> {
    const brand = await this.prisma.brand.findFirst({ where: { slug, isActive: true } });
    if (!brand) throw ApiError.notFound('Brend topilmadi');
    const [stats, collections] = await Promise.all([
      this.cache.catalogStats(),
      this.collections({ brandId: brand.id, brandSlug: brand.slug }),
    ]);
    return {
      id: brand.id,
      slug: brand.slug,
      name: brand.name,
      logoUrl: this.media.urlOrNull(brand.logoUrl),
      productCount: stats.count({ brandId: brand.id }),
      description: brand.description,
      country: brand.country,
      website: brand.website,
      sections: collections,
    };
  }

  // ──────────────────────── Kategoriyalar va materiallar ────────────────────────

  categoryTree(): Promise<CategoryNode[]> {
    return this.categories.tree();
  }

  async category(slug: string): Promise<CategoryDetail> {
    const tree = await this.cache.categoryTree();
    const category = tree.bySlug.get(slug);
    if (!category || !tree.isVisible(category.id)) throw ApiError.notFound('Kategoriya topilmadi');
    return this.categories.detail(category);
  }

  async materials(): Promise<MaterialSummary[]> {
    const [rows, stats] = await Promise.all([
      this.prisma.material.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.cache.catalogStats(),
    ]);
    const counts = stats.countBy('materialId');
    return rows.map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      fullName: m.fullName,
      productCount: counts.get(m.id) ?? 0,
    }));
  }

  /**
   * "Material bo'yicha" tugmalari (faqat mahsuloti borlari). Brend sahifasi uchun —
   * shu brend mahsulotlari bo'yicha sanaladi va filtrga brend qo'shiladi.
   */
  async collections(brand?: { brandId: string; brandSlug: string }): Promise<CollectionSummary[]> {
    const [rows, tree, stats] = await Promise.all([
      this.prisma.homeCollection.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        include: {
          material: { select: { slug: true, isActive: true } },
          category: { select: { slug: true } },
          brand: { select: { slug: true, isActive: true } },
        },
      }),
      this.cache.categoryTree(),
      this.cache.catalogStats(),
    ]);

    return rows.flatMap((row) => {
      if (row.material && !row.material.isActive) return [];
      if (row.brand && !row.brand.isActive) return [];
      if (brand && row.brandId && row.brandId !== brand.brandId) return [];
      if (row.categoryId && !tree.isVisible(row.categoryId)) return [];
      const count = this.countCollection(stats, tree, {
        brandId: brand?.brandId ?? row.brandId,
        categoryId: row.categoryId,
        materialId: row.materialId,
      });
      if (count === 0) return [];
      return [
        {
          slug: row.slug,
          title: row.title,
          imageUrl: this.media.urlOrNull(row.imageUrl),
          filter: {
            category: row.category?.slug ?? null,
            material: row.material?.slug ?? null,
            brand: brand?.brandSlug ?? row.brand?.slug ?? null,
          },
          productCount: count,
        },
      ];
    });
  }

  private countCollection(
    stats: CatalogStats,
    tree: CategoryTree,
    filter: { brandId: string | null; categoryId: string | null; materialId: string | null },
  ): number {
    return stats.count({
      brandId: filter.brandId,
      materialId: filter.materialId,
      categoryIds: filter.categoryId ? new Set(tree.descendantIds(filter.categoryId)) : null,
    });
  }

  // ─────────────────────────────── Mahsulot ───────────────────────────────

  async product(slug: string): Promise<ProductDetail> {
    const [row, tree] = await Promise.all([
      this.prisma.product.findUnique({ where: { slug }, select: DETAIL_SELECT }),
      this.cache.categoryTree(),
    ]);
    if (!row || !row.isActive || !row.brand.isActive || !tree.isVisible(row.categoryId)) {
      throw ApiError.notFound('Mahsulot topilmadi');
    }

    const now = Date.now();
    const card = this.cards.toCard(row, now);
    const category = tree.byId.get(row.categoryId)!;
    const attributes: ProductAttribute[] = row.attributeValues
      .filter((v) => v.attribute.isVisible)
      .sort((a, b) => a.attribute.sortOrder - b.attribute.sortOrder)
      .map((v) => ({
        key: v.attribute.key,
        name: v.attribute.name,
        unit: v.attribute.unit,
        value: formatValue(v),
        numberValue: v.numberValue,
      }));

    const [variants, variantAttributeName] = await this.variants(row.id, row.groupId, row.group);

    return {
      ...card,
      shortDescription: row.shortDescription,
      description: row.description,
      images: row.images.map((image) => this.media.imageUrls(image)),
      category: { slug: category.slug, name: category.name },
      breadcrumbs: this.categories.breadcrumbs(tree, row.categoryId),
      material: row.material,
      attributes,
      variants,
      variantAttributeName,
      documents: row.documents.map((d) => ({
        type: d.type,
        title: d.title,
        url: this.media.url(d.url),
      })),
      weightGrams: row.weightGrams,
      warrantyMonths: row.warrantyMonths,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
    };
  }

  private async variants(
    productId: string,
    groupId: string | null,
    group: { variantAttributeKey: string | null } | null,
  ): Promise<[ProductVariant[], string | null]> {
    const key = group?.variantAttributeKey;
    if (!groupId || !key) return [[], null];
    const attribute = (await this.cache.attributes()).find((a) => a.key === key);
    if (!attribute) return [[], null];

    const rows = await this.prisma.product.findMany({
      where: { groupId, isActive: true, brand: { isActive: true } },
      select: {
        id: true,
        slug: true,
        sku: true,
        currentPrice: true,
        availableStock: true,
        attributeValues: {
          where: { attributeId: attribute.id },
          select: { numberValue: true, textValue: true, booleanValue: true },
        },
      },
    });
    const variants = rows
      .map((r) => {
        const value = r.attributeValues[0];
        return {
          variant: {
            slug: r.slug,
            sku: r.sku,
            label: value ? variantLabel(key, attribute.unit, value) : r.sku,
            price: r.currentPrice,
            inStock: r.availableStock > 0,
            isCurrent: r.id === productId,
          },
          sortNumber: value?.numberValue ?? null,
        };
      })
      .sort((a, b) =>
        a.sortNumber !== null && b.sortNumber !== null
          ? a.sortNumber - b.sortNumber
          : a.variant.label.localeCompare(b.variant.label, 'uz', { numeric: true }),
      )
      .map((v) => v.variant);
    return variants.length > 1 ? [variants, attribute.name] : [[], null];
  }

  /** O'xshash mahsulotlar: avval shu kategoriya va materialdan, keyin shu kategoriyadan. */
  async similar(slug: string): Promise<ProductCard[]> {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true, categoryId: true, materialId: true, groupId: true },
    });
    if (!product) throw ApiError.notFound('Mahsulot topilmadi');

    const base: Prisma.ProductWhereInput = {
      id: { not: product.id },
      isActive: true,
      brand: { isActive: true },
      categoryId: product.categoryId,
      ...(product.groupId
        ? { OR: [{ groupId: null }, { groupId: { not: product.groupId } }] }
        : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { soldCount: 'desc' },
      { createdAt: 'desc' },
    ];
    const first = product.materialId
      ? await this.prisma.product.findMany({
          where: { ...base, materialId: product.materialId, availableStock: { gt: 0 } },
          orderBy,
          take: SIMILAR_LIMIT,
          select: CARD_SELECT,
        })
      : [];
    const rest =
      first.length < SIMILAR_LIMIT
        ? await this.prisma.product.findMany({
            where: { ...base, id: { notIn: [product.id, ...first.map((p) => p.id)] } },
            orderBy: [{ availableStock: 'desc' }, ...orderBy],
            take: SIMILAR_LIMIT - first.length,
            select: CARD_SELECT,
          })
        : [];
    const now = Date.now();
    return [...first, ...rest].map((row) => this.cards.toCard(row, now));
  }

  /** sitemap.xml uchun ochiq sahifalar ro'yxati (Google va boshqa qidiruv tizimlari uchun). */
  async sitemap(): Promise<SitemapData> {
    const [products, brands, tree] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true, brand: { isActive: true }, category: { isActive: true } },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 45_000,
      }),
      this.prisma.brand.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      this.cache.categoryTree(),
    ]);
    return {
      products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt.toISOString() })),
      brands: brands.map((b) => ({ slug: b.slug, updatedAt: b.updatedAt.toISOString() })),
      categories: [...tree.byId.values()]
        .filter((c) => tree.isVisible(c.id))
        .map((c) => ({ slug: c.slug })),
    };
  }

  // ─────────────────────────────── Qidiruv ───────────────────────────────

  async suggest(q: string): Promise<SearchSuggestions> {
    const tokens = searchTokens(q);
    if (tokens.length === 0) return { query: q, products: [], brands: [], categories: [] };

    const matches = (name: string) => {
      const words = normalizeSearchText(name).split(' ');
      return tokens.some((t) => t.length >= 2 && words.some((w) => w.startsWith(t)));
    };
    const [result, brands, tree] = await Promise.all([
      this.products.list(productListQuerySchema.parse({ q, pageSize: 6, sort: 'relevance' }), {
        withFacets: false,
      }),
      this.brands(),
      this.cache.categoryTree(),
    ]);
    const categories = [...tree.byId.values()]
      .filter((c) => tree.isVisible(c.id) && matches(c.name))
      .slice(0, 5)
      .map((c) => ({ slug: c.slug, name: c.name }));
    return {
      query: q,
      products: result.items,
      brands: brands
        .filter((b) => b.productCount > 0 && matches(b.name))
        .slice(0, 5)
        .map((b) => ({ slug: b.slug, name: b.name })),
      categories,
    };
  }
}
