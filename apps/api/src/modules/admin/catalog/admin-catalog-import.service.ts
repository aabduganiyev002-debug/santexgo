import { Injectable } from '@nestjs/common';
import type {
  CatalogImportBatchResult,
  CatalogImportImageResult,
  CatalogImportProductResult,
  catalogImportBatchSchema,
  ImportBrand,
  ImportCategory,
  ImportMaterial,
  z,
} from '@santexgo/shared';
import type { ActorContext } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { MediaService } from '../../../infra/storage/media.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { CatalogCacheService } from '../../catalog/catalog-cache.service.js';
import { AdminProductsService } from './admin-products.service.js';

type BatchInput = z.output<typeof catalogImportBatchSchema>;

/**
 * Katalog importi (admin panel ZIP faylni bo'laklab yuboradi). Mahsulotlar SKU bo'yicha:
 * yangisi yaratiladi (boshlang'ich qoldig'i bilan), mavjudida faqat nom, narx, o'lchov birligi,
 * qisqa tavsif va xususiyatlar yangilanadi — qoldiq, kategoriya va rasmlarga tegilmaydi.
 * Kategoriya, brend va materiallar slug bo'yicha: yo'g'i yaratiladi, borini o'zgartirmaydi.
 */
@Injectable()
export class AdminCatalogImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: AdminProductsService,
    private readonly media: MediaService,
    private readonly cache: CatalogCacheService,
    private readonly audit: AuditService,
  ) {}

  async importBatch(input: BatchInput, actor: ActorContext): Promise<CatalogImportBatchResult> {
    const warnings = new Set<string>();
    if (input.categories?.length) await this.upsertCategories(input.categories, warnings);
    // Shu nomli brend/material boshqa slug bilan bo'lsa — o'shanisi ishlatiladi (slug → id)
    const brandAliases = await this.upsertBrands(input.brands ?? []);
    const materialAliases = await this.upsertMaterials(input.materials ?? []);

    const products = input.products;
    const [categories, brands, materials, attributes, existing] = await Promise.all([
      this.idsBySlug(
        'category',
        products.map((p) => p.category),
      ),
      this.idsBySlug(
        'brand',
        products.map((p) => p.brand),
        brandAliases,
      ),
      this.idsBySlug(
        'material',
        products.flatMap((p) => (p.material ? [p.material] : [])),
        materialAliases,
      ),
      this.prisma.attribute.findMany({ select: { key: true } }),
      this.prisma.product.findMany({
        where: { sku: { in: products.map((p) => p.sku) } },
        select: { id: true, sku: true, _count: { select: { images: true } } },
      }),
    ]);
    const knownAttributes = new Set(attributes.map((a) => a.key));
    const existingBySku = new Map(existing.map((p) => [p.sku, p]));
    const groups = new Map<string, string>();

    const results: CatalogImportProductResult[] = [];
    for (const product of products) {
      try {
        const attributeValues = Object.entries(product.attributes ?? {}).flatMap(([key, value]) => {
          if (knownAttributes.has(key)) return [{ key, value }];
          warnings.add(`Noma’lum xususiyat e’tiborsiz qoldirildi: ${key}`);
          return [];
        });
        const found = existingBySku.get(product.sku);
        if (found) {
          await this.products.updateProduct(
            found.id,
            {
              name: product.name,
              basePrice: product.price,
              unit: product.unit,
              // Kalit berilsa — bo'sh qiymat mavjud tavsifni o'chirardi
              ...(product.shortDescription ? { shortDescription: product.shortDescription } : {}),
              attributes: attributeValues.length > 0 ? attributeValues : undefined,
            },
            actor,
          );
          results.push({
            sku: product.sku,
            id: found.id,
            status: 'updated',
            hasImages: found._count.images > 0,
          });
          continue;
        }

        const categoryId = categories.get(product.category);
        if (!categoryId) {
          throw ApiError.badRequest(
            'INVALID_REFERENCE',
            `Kategoriya topilmadi: ${product.category}`,
          );
        }
        const brandId = brands.get(product.brand);
        if (!brandId) {
          throw ApiError.badRequest('INVALID_REFERENCE', `Brend topilmadi: ${product.brand}`);
        }
        let materialId: string | null = null;
        if (product.material) {
          materialId = materials.get(product.material) ?? null;
          if (!materialId)
            warnings.add(`Material topilmadi, bo‘sh qoldirildi: ${product.material}`);
        }
        const id = await this.products.createProduct(
          {
            sku: product.sku,
            name: product.name,
            brandId,
            categoryId,
            materialId,
            groupId: product.group
              ? await this.groupId(product.group, product.groupAttribute, groups)
              : null,
            unit: product.unit,
            basePrice: product.price,
            initialStock: product.stock,
            shortDescription: product.shortDescription,
            description: product.description,
            metaTitle: undefined,
            metaDescription: undefined,
            attributes: attributeValues,
          },
          actor,
        );
        results.push({ sku: product.sku, id, status: 'created', hasImages: false });
      } catch (error) {
        results.push({
          sku: product.sku,
          id: null,
          status: 'failed',
          hasImages: false,
          error: describeError(error),
        });
      }
    }

    this.cache.invalidate();
    const count = (status: CatalogImportProductResult['status']) =>
      results.filter((r) => r.status === status).length;
    const summary = {
      created: count('created'),
      updated: count('updated'),
      failed: count('failed'),
    };
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'catalog.import',
      entityType: 'product',
      changes: summary,
    });
    return { ...summary, products: results, warnings: [...warnings] };
  }

  /**
   * Bitta rasm — bir nechta mahsulotga (masalan, bir modelning barcha o'lchamlari): fayllar bir marta
   * saqlanadi. Rasmi bor mahsulotlarga biriktirilmaydi — qayta import rasmlarni ko'paytirmaydi.
   */
  async attachImage(
    file: Buffer,
    skus: string[],
    actor: ActorContext,
  ): Promise<CatalogImportImageResult> {
    const products = await this.prisma.product.findMany({
      where: { sku: { in: skus } },
      select: { id: true, name: true, _count: { select: { images: true } } },
    });
    const targets = products.filter((p) => p._count.images === 0);
    const skipped = new Set(skus).size - targets.length;
    if (targets.length === 0) return { attached: 0, skipped };

    const stored = await this.media.saveImage('products/import', file);
    try {
      await this.prisma.productImage.createMany({
        data: targets.map((product) => ({
          productId: product.id,
          storageKey: stored.url,
          url: stored.url,
          mediumUrl: stored.mediumUrl,
          thumbUrl: stored.thumbUrl,
          width: stored.width,
          height: stored.height,
          alt: product.name,
          sortOrder: 0,
          isMain: true,
        })),
      });
    } catch (error) {
      await this.media.remove([stored.url, stored.mediumUrl, stored.thumbUrl]);
      throw error;
    }
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'catalog.import_image',
      entityType: 'product',
      changes: { count: targets.length },
    });
    return { attached: targets.length, skipped };
  }

  // ─────────────────────────── Kategoriya, brend, material ───────────────────────────

  private async upsertCategories(list: ImportCategory[], warnings: Set<string>): Promise<void> {
    for (const category of list) {
      let row = await this.prisma.category.findUnique({
        where: { slug: category.slug },
        select: { id: true },
      });
      if (!row) {
        let parentId: string | null = null;
        if (category.parent) {
          const parent = await this.prisma.category.findUnique({
            where: { slug: category.parent },
            select: { id: true },
          });
          if (!parent) warnings.add(`Ota kategoriya topilmadi: ${category.parent}`);
          parentId = parent?.id ?? null;
        }
        row = await this.prisma.category.create({
          data: {
            slug: category.slug,
            name: category.name,
            parentId,
            sortOrder: category.sortOrder ?? 0,
          },
          select: { id: true },
        });
      }
      if (category.attributes?.length) {
        const keys = category.attributes;
        const attributes = await this.prisma.attribute.findMany({
          where: { key: { in: keys } },
          select: { id: true, key: true },
        });
        await this.prisma.categoryAttribute.createMany({
          data: attributes.map((attribute) => ({
            categoryId: row.id,
            attributeId: attribute.id,
            sortOrder: keys.indexOf(attribute.key),
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  /**
   * Yo'g'i yaratiladi. Nom ham noyob: shu nomli brend boshqa slug bilan bo'lsa (admin o'zi qo'shgan) —
   * o'shanisi ishlatiladi. Natija: import slug'i → brend ID.
   */
  private async upsertBrands(list: ImportBrand[]): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    for (const brand of list) {
      const existing = await this.prisma.brand.findFirst({
        where: {
          OR: [{ slug: brand.slug }, { name: { equals: brand.name, mode: 'insensitive' } }],
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      const row =
        existing ??
        (await this.prisma.brand.create({
          data: { slug: brand.slug, name: brand.name, country: brand.country ?? null },
          select: { id: true },
        }));
      ids.set(brand.slug, row.id);
    }
    return ids;
  }

  private async upsertMaterials(list: ImportMaterial[]): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    for (const material of list) {
      const existing = await this.prisma.material.findFirst({
        where: {
          OR: [{ slug: material.slug }, { name: { equals: material.name, mode: 'insensitive' } }],
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      const row =
        existing ??
        (await this.prisma.material.create({
          data: { slug: material.slug, name: material.name, fullName: material.fullName ?? null },
          select: { id: true },
        }));
      ids.set(material.slug, row.id);
    }
    return ids;
  }

  /** slug → id (aliases — shu so'rovdagi brend/material ro'yxatidan topilganlari) */
  private async idsBySlug(
    kind: 'category' | 'brand' | 'material',
    slugs: string[],
    aliases: Map<string, string> = new Map(),
  ): Promise<Map<string, string>> {
    const unique = [...new Set(slugs)].filter((slug) => !aliases.has(slug));
    const ids = new Map(aliases);
    if (unique.length === 0) return ids;
    const where = { slug: { in: unique } };
    const select = { id: true, slug: true };
    const rows =
      kind === 'category'
        ? await this.prisma.category.findMany({ where, select })
        : kind === 'brand'
          ? await this.prisma.brand.findMany({ where, select })
          : await this.prisma.material.findMany({ where, select });
    for (const row of rows) ids.set(row.slug, row.id);
    return ids;
  }

  private async groupId(
    name: string,
    variantAttributeKey: string | undefined,
    cache: Map<string, string>,
  ): Promise<string> {
    const cached = cache.get(name);
    if (cached) return cached;
    const existing = await this.prisma.productGroup.findFirst({
      where: { name },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const id =
      existing?.id ??
      (
        await this.prisma.productGroup.create({
          data: { name, variantAttributeKey: variantAttributeKey ?? null },
          select: { id: true },
        })
      ).id;
    cache.set(name, id);
    return id;
  }
}

/** Mahsulot qatoridagi xato — foydalanuvchiga ko'rsatiladigan matn (maydon xatolari bilan) */
function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.getResponse() as { message?: string; errors?: { message: string }[] };
    const message = body.message ?? error.message;
    const details = body.errors?.map((e) => e.message).join('; ');
    return details && details !== message ? `${message}: ${details}` : message;
  }
  return error instanceof Error ? error.message : String(error);
}
