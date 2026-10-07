import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type adminProductListQuerySchema,
  type AdminInventoryMovement,
  type AdminProductAttributeValue,
  type AdminProductDetail,
  type AdminProductImage,
  type AdminProductListItem,
  type AdminWarehouseStock,
  type DeleteResult,
  discountPercentOf,
  type documentInputSchema,
  type imageUpdateSchema,
  type InventoryAdjustInput,
  LOW_STOCK_DISPLAY_THRESHOLD,
  type Paginated,
  type productInputSchema,
  type productUpdateSchema,
  searchTokens,
  type z,
} from '@santexgo/shared';
import type { ActorContext } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { uniqueViolationTarget } from '../../../common/errors/prisma-error.js';
import { resolveSlug } from '../../../common/utils/unique-slug.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { MediaService, type StoredImage } from '../../../infra/storage/media.service.js';
import { AuditService, diffChanges } from '../../audit/audit.service.js';
import { CatalogCacheService } from '../../catalog/catalog-cache.service.js';
import { IMAGE_ORDER } from '../../catalog/product-card.mapper.js';
import { SearchTextService } from '../../catalog/search-text.service.js';
import { InventoryService } from '../../inventory/inventory.service.js';
import { PricingService } from '../../pricing/pricing.service.js';

type ProductCreate = z.output<typeof productInputSchema>;
type ProductUpdate = z.output<typeof productUpdateSchema>;
type ListQuery = z.output<typeof adminProductListQuerySchema>;
type AttributeInput = NonNullable<ProductCreate['attributes']>[number];

const MAX_IMAGES_PER_PRODUCT = 30;

const LIST_INCLUDE = {
  brand: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  material: { select: { id: true, name: true } },
  images: { select: { thumbUrl: true, url: true }, orderBy: IMAGE_ORDER, take: 1 },
} satisfies Prisma.ProductInclude;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  group: { select: { id: true, name: true, variantAttributeKey: true } },
  appliedDiscount: { select: { id: true, name: true, endsAt: true } },
  images: { orderBy: IMAGE_ORDER },
  documents: { orderBy: { sortOrder: 'asc' } },
  attributeValues: {
    include: {
      attribute: {
        select: { id: true, key: true, name: true, unit: true, type: true, sortOrder: true },
      },
    },
  },
  _count: { select: { orderItems: true } },
} satisfies Prisma.ProductInclude;

type ListRow = Prisma.ProductGetPayload<{ include: typeof LIST_INCLUDE }>;

interface ResolvedAttributeValue {
  attributeId: string;
  /** null — qiymat o'chiriladi */
  data: {
    numberValue: number | null;
    textValue: string | null;
    booleanValue: boolean | null;
  } | null;
}

/** Admin: mahsulotlar, ularning rasmlari, hujjatlari, xususiyatlari va ombordagi qoldig'i. */
@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly cache: CatalogCacheService,
    private readonly searchText: SearchTextService,
    private readonly pricing: PricingService,
    private readonly inventory: InventoryService,
  ) {}

  // ─────────────────────────────── Ro'yxat ───────────────────────────────

  async list(query: ListQuery): Promise<Paginated<AdminProductListItem>> {
    const and: Prisma.ProductWhereInput[] = [];
    if (query.status === 'active') and.push({ isActive: true });
    if (query.status === 'archived') and.push({ isActive: false });
    if (query.brandId) and.push({ brandId: query.brandId });
    if (query.materialId) and.push({ materialId: query.materialId });
    if (query.categoryId) {
      const tree = await this.cache.categoryTree();
      and.push({ categoryId: { in: tree.descendantIds(query.categoryId, false) } });
    }
    if (query.stock === 'out') and.push({ availableStock: 0 });
    if (query.stock === 'low') {
      and.push({ availableStock: { gt: 0, lte: LOW_STOCK_DISPLAY_THRESHOLD } });
    }
    if (query.stock === 'in') and.push({ availableStock: { gt: 0 } });
    if (query.q) {
      for (const token of searchTokens(query.q)) {
        and.push({
          OR: [
            { searchText: { contains: token } },
            { sku: { contains: token, mode: 'insensitive' } },
            { name: { contains: token, mode: 'insensitive' } },
          ],
        });
      }
    }
    const where: Prisma.ProductWhereInput = and.length > 0 ? { AND: and } : {};

    const orderBy: Record<ListQuery['sort'], Prisma.ProductOrderByWithRelationInput[]> = {
      new: [{ createdAt: 'desc' }],
      name: [{ name: 'asc' }],
      price_asc: [{ currentPrice: 'asc' }],
      price_desc: [{ currentPrice: 'desc' }],
      stock_asc: [{ availableStock: 'asc' }],
      stock_desc: [{ availableStock: 'desc' }],
      sold: [{ soldCount: 'desc' }],
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [...orderBy[query.sort], { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: LIST_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);
    const reserved = await this.reservedByProduct(rows.map((r) => r.id));
    return {
      items: rows.map((row) => this.listItem(row, reserved.get(row.id) ?? 0)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  // ─────────────────────────────── Bitta mahsulot ───────────────────────────────

  async get(id: string): Promise<AdminProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!product) throw ApiError.notFound('Mahsulot topilmadi');
    const stock = await this.inventory.productStock(id);
    const reserved = stock.reduce((sum, s) => sum + s.reserved, 0);
    const { thumbUrl: _thumbUrl, ...base } = this.listItem(product, reserved);

    return {
      ...base,
      brandId: product.brandId,
      categoryId: product.categoryId,
      materialId: product.materialId,
      groupId: product.groupId,
      group: product.group,
      shortDescription: product.shortDescription,
      description: product.description,
      minOrderQty: product.minOrderQty,
      weightGrams: product.weightGrams,
      warrantyMonths: product.warrantyMonths,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      attributes: product.attributeValues
        .sort((a, b) => a.attribute.sortOrder - b.attribute.sortOrder)
        .map((v): AdminProductAttributeValue => ({
          attributeId: v.attribute.id,
          key: v.attribute.key,
          name: v.attribute.name,
          unit: v.attribute.unit,
          type: v.attribute.type,
          value: v.numberValue ?? v.textValue ?? v.booleanValue ?? '',
        })),
      images: product.images.map((image) => this.imageDto(image)),
      documents: product.documents.map((d) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        url: this.media.url(d.url),
      })),
      stock,
      appliedDiscount: product.appliedDiscount
        ? {
            id: product.appliedDiscount.id,
            name: product.appliedDiscount.name,
            endsAt: product.appliedDiscount.endsAt?.toISOString() ?? null,
          }
        : null,
      hasOrders: product._count.orderItems > 0,
    };
  }

  // ─────────────────────────── Yaratish va tahrirlash ───────────────────────────

  async create(input: ProductCreate, actor: ActorContext): Promise<AdminProductDetail> {
    await this.assertReferences(input);
    await this.assertSkuFree(input.sku);
    const attributes = input.attributes ? await this.resolveAttributes(input.attributes) : [];
    const slug = await this.slugFor(input.slug, input.name);
    const price = await this.pricing.quote({
      id: '',
      brandId: input.brandId,
      categoryId: input.categoryId,
      basePrice: input.basePrice,
    });

    let productId: string;
    try {
      productId = await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            sku: input.sku,
            name: input.name,
            slug,
            brandId: input.brandId,
            categoryId: input.categoryId,
            materialId: input.materialId,
            groupId: input.groupId,
            shortDescription: input.shortDescription ?? null,
            description: input.description ?? null,
            unit: input.unit,
            basePrice: input.basePrice,
            // Mahsulot ID'si hali yo'q edi — brend/kategoriya chegirmalari hisobga olingan
            currentPrice: price.finalPrice,
            appliedDiscountId: price.discountId,
            minOrderQty: input.minOrderQty,
            weightGrams: input.weightGrams ?? null,
            warrantyMonths: input.warrantyMonths ?? null,
            isActive: input.isActive,
            isFeatured: input.isFeatured,
            metaTitle: input.metaTitle ?? null,
            metaDescription: input.metaDescription ?? null,
          },
          select: { id: true },
        });
        await this.writeAttributes(tx, product.id, attributes);
        if (input.initialStock && input.initialStock > 0) {
          const warehouse = await this.inventory.defaultWarehouse(tx);
          const before = await this.inventory.lockRow(tx, product.id, warehouse.id);
          await this.inventory.applyMovement(tx, {
            productId: product.id,
            warehouseId: warehouse.id,
            type: 'RESTOCK',
            quantityChange: input.initialStock,
            reservedChange: 0,
            before,
            note: 'Boshlang‘ich qoldiq',
            createdById: actor.userId,
          });
        }
        return product.id;
      });
    } catch (error) {
      throw this.mapUniqueError(error);
    }

    await this.afterChange(productId);
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'product.create',
      entityType: 'product',
      entityId: productId,
      changes: { sku: input.sku, name: input.name, basePrice: input.basePrice },
    });
    return this.get(productId);
  }

  async update(id: string, input: ProductUpdate, actor: ActorContext): Promise<AdminProductDetail> {
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before) throw ApiError.notFound('Mahsulot topilmadi');
    await this.assertReferences(input);
    if (input.sku && input.sku !== before.sku) await this.assertSkuFree(input.sku, id);
    const attributes = input.attributes ? await this.resolveAttributes(input.attributes) : [];
    const slug =
      input.slug && input.slug !== before.slug
        ? await this.slugFor(input.slug, input.slug, id)
        : undefined;

    // Narx, brend yoki kategoriya o'zgarsa — chegirmali narx shu yozuvning o'zida qayta hisoblanadi
    const priceInputs = {
      id,
      brandId: input.brandId ?? before.brandId,
      categoryId: input.categoryId ?? before.categoryId,
      basePrice: input.basePrice ?? before.basePrice,
    };
    const priceChanged =
      priceInputs.brandId !== before.brandId ||
      priceInputs.categoryId !== before.categoryId ||
      priceInputs.basePrice !== before.basePrice;
    const price = priceChanged ? await this.pricing.quote(priceInputs) : null;

    let after;
    try {
      after = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id },
          data: {
            sku: input.sku,
            name: input.name,
            slug,
            brandId: input.brandId,
            categoryId: input.categoryId,
            materialId: input.materialId,
            groupId: input.groupId,
            shortDescription:
              'shortDescription' in input ? (input.shortDescription ?? null) : undefined,
            description: 'description' in input ? (input.description ?? null) : undefined,
            unit: input.unit,
            basePrice: input.basePrice,
            currentPrice: price?.finalPrice,
            appliedDiscountId: price ? price.discountId : undefined,
            minOrderQty: input.minOrderQty,
            weightGrams: input.weightGrams,
            warrantyMonths: input.warrantyMonths,
            isActive: input.isActive,
            isFeatured: input.isFeatured,
            metaTitle: 'metaTitle' in input ? (input.metaTitle ?? null) : undefined,
            metaDescription:
              'metaDescription' in input ? (input.metaDescription ?? null) : undefined,
          },
        });
        await this.writeAttributes(tx, id, attributes);
        return updated;
      });
    } catch (error) {
      throw this.mapUniqueError(error);
    }

    await this.afterChange(id);
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'product.update',
      entityType: 'product',
      entityId: id,
      changes: {
        ...diffChanges(before, after),
        ...(input.attributes ? { attributes: input.attributes } : {}),
      },
    });
    return this.get(id);
  }

  /** Buyurtmalarda bo'lsa — arxivlanadi (saytda ko'rinmaydi), aks holda butunlay o'chiriladi. */
  async remove(id: string, actor: ActorContext): Promise<DeleteResult> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        documents: true,
        _count: { select: { orderItems: true } },
      },
    });
    if (!product) throw ApiError.notFound('Mahsulot topilmadi');

    if (product._count.orderItems > 0) {
      await this.prisma.product.update({ where: { id }, data: { isActive: false } });
      this.cache.invalidate();
      await this.audit.log({
        actorId: actor.userId,
        ipAddress: actor.ipAddress,
        action: 'product.archive',
        entityType: 'product',
        entityId: id,
        changes: { sku: product.sku },
      });
      return { result: 'archived' };
    }

    await this.prisma.product.delete({ where: { id } });
    await this.media.remove([
      ...product.images.flatMap((i) => [i.url, i.mediumUrl, i.thumbUrl]),
      ...product.documents.map((d) => d.url),
    ]);
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'product.delete',
      entityType: 'product',
      entityId: id,
      changes: { sku: product.sku, name: product.name },
    });
    return { result: 'deleted' };
  }

  async restore(id: string, actor: ActorContext): Promise<AdminProductDetail> {
    const product = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) throw ApiError.notFound('Mahsulot topilmadi');
    await this.prisma.product.update({ where: { id }, data: { isActive: true } });
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'product.restore',
      entityType: 'product',
      entityId: id,
    });
    return this.get(id);
  }

  // ─────────────────────────────── Rasmlar ───────────────────────────────

  async uploadImages(
    id: string,
    files: Buffer[],
    actor: ActorContext,
  ): Promise<AdminProductImage[]> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { images: true } } },
    });
    if (!product) throw ApiError.notFound('Mahsulot topilmadi');
    if (product._count.images + files.length > MAX_IMAGES_PER_PRODUCT) {
      throw ApiError.badRequest(
        'FILE_INVALID',
        `Bitta mahsulotga ko‘pi bilan ${MAX_IMAGES_PER_PRODUCT} ta rasm yuklash mumkin`,
      );
    }

    // Avval hammasi tekshiriladi va saqlanadi; biror rasm xato bo'lsa — saqlanganlari o'chiriladi
    const stored: StoredImage[] = [];
    try {
      for (const file of files) stored.push(await this.media.saveImage(`products/${id}`, file));
    } catch (error) {
      await this.media.remove(stored.flatMap((s) => [s.url, s.mediumUrl, s.thumbUrl]));
      throw error;
    }

    await this.prisma.$transaction(async (tx) => {
      const last = await tx.productImage.aggregate({
        where: { productId: id },
        _max: { sortOrder: true },
      });
      const hasMain = (await tx.productImage.count({ where: { productId: id, isMain: true } })) > 0;
      let sortOrder = (last._max.sortOrder ?? -1) + 1;
      for (const [index, image] of stored.entries()) {
        await tx.productImage.create({
          data: {
            productId: id,
            storageKey: image.url,
            url: image.url,
            mediumUrl: image.mediumUrl,
            thumbUrl: image.thumbUrl,
            width: image.width,
            height: image.height,
            alt: product.name,
            sortOrder: sortOrder++,
            isMain: !hasMain && index === 0,
          },
        });
      }
    });
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'product.images_upload',
      entityType: 'product',
      entityId: id,
      changes: { count: stored.length },
    });
    return this.images(id);
  }

  async updateImage(
    id: string,
    imageId: string,
    input: z.output<typeof imageUpdateSchema>,
    actor: ActorContext,
  ): Promise<AdminProductImage[]> {
    await this.findImage(id, imageId);
    await this.prisma.$transaction(async (tx) => {
      if (input.isMain) {
        await tx.productImage.updateMany({ where: { productId: id }, data: { isMain: false } });
      }
      await tx.productImage.update({
        where: { id: imageId },
        data: {
          alt: 'alt' in input ? (input.alt ?? null) : undefined,
          sortOrder: input.sortOrder,
          isMain: input.isMain,
        },
      });
    });
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'product.image_update',
      entityType: 'product',
      entityId: id,
      changes: { imageId, ...input },
    });
    return this.images(id);
  }

  async reorderImages(
    id: string,
    imageIds: string[],
    actor: ActorContext,
  ): Promise<AdminProductImage[]> {
    const images = await this.prisma.productImage.findMany({
      where: { productId: id },
      select: { id: true },
    });
    const own = new Set(images.map((i) => i.id));
    if (imageIds.length !== own.size || !imageIds.every((imageId) => own.has(imageId))) {
      throw ApiError.badRequest('BAD_REQUEST', 'Rasmlar ro‘yxati mahsulot rasmlariga mos emas');
    }
    await this.prisma.$transaction(
      imageIds.map((imageId, index) =>
        this.prisma.productImage.update({ where: { id: imageId }, data: { sortOrder: index } }),
      ),
    );
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'product.images_reorder',
      entityType: 'product',
      entityId: id,
    });
    return this.images(id);
  }

  async removeImage(
    id: string,
    imageId: string,
    actor: ActorContext,
  ): Promise<AdminProductImage[]> {
    const image = await this.findImage(id, imageId);
    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: imageId } });
      if (image.isMain) {
        const next = await tx.productImage.findFirst({
          where: { productId: id },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });
        if (next) await tx.productImage.update({ where: { id: next.id }, data: { isMain: true } });
      }
    });
    await this.media.remove([image.url, image.mediumUrl, image.thumbUrl]);
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'product.image_delete',
      entityType: 'product',
      entityId: id,
      changes: { imageId },
    });
    return this.images(id);
  }

  private async images(productId: string): Promise<AdminProductImage[]> {
    const images = await this.prisma.productImage.findMany({
      where: { productId },
      orderBy: IMAGE_ORDER,
    });
    return images.map((image) => this.imageDto(image));
  }

  private async findImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) throw ApiError.notFound('Rasm topilmadi');
    return image;
  }

  // ─────────────────────────────── Hujjatlar ───────────────────────────────

  async uploadDocument(
    id: string,
    file: Buffer,
    input: z.output<typeof documentInputSchema>,
    actor: ActorContext,
  ): Promise<AdminProductDetail['documents']> {
    if ((await this.prisma.product.count({ where: { id } })) === 0) {
      throw ApiError.notFound('Mahsulot topilmadi');
    }
    const key = await this.media.saveDocument(`products/${id}/docs`, file);
    const last = await this.prisma.productDocument.aggregate({
      where: { productId: id },
      _max: { sortOrder: true },
    });
    await this.prisma.productDocument.create({
      data: {
        productId: id,
        type: input.type,
        title: input.title,
        storageKey: key,
        url: key,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
      },
    });
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'product.document_upload',
      entityType: 'product',
      entityId: id,
      changes: { title: input.title, type: input.type },
    });
    return (await this.get(id)).documents;
  }

  async removeDocument(id: string, documentId: string, actor: ActorContext): Promise<void> {
    const document = await this.prisma.productDocument.findFirst({
      where: { id: documentId, productId: id },
    });
    if (!document) throw ApiError.notFound('Hujjat topilmadi');
    await this.prisma.productDocument.delete({ where: { id: documentId } });
    await this.media.remove([document.url]);
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'product.document_delete',
      entityType: 'product',
      entityId: id,
      changes: { title: document.title },
    });
  }

  // ─────────────────────────────── Ombor ───────────────────────────────

  async adjustStock(
    id: string,
    input: InventoryAdjustInput & { quantity: number },
    actor: ActorContext,
  ): Promise<AdminWarehouseStock[]> {
    const before = await this.inventory.productStock(id);
    await this.inventory.adjust(id, input, actor.userId);
    const after = await this.inventory.productStock(id);
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'inventory.adjust',
      entityType: 'product',
      entityId: id,
      changes: {
        operation: input.operation,
        quantity: input.quantity,
        note: input.note,
        before: before.map((s) => ({ warehouse: s.warehouseCode, quantity: s.quantity })),
        after: after.map((s) => ({ warehouse: s.warehouseCode, quantity: s.quantity })),
      },
    });
    return after;
  }

  async setLowStockThreshold(
    id: string,
    threshold: number,
    warehouseId: string | undefined,
    actor: ActorContext,
  ): Promise<AdminWarehouseStock[]> {
    if ((await this.prisma.product.count({ where: { id } })) === 0) {
      throw ApiError.notFound('Mahsulot topilmadi');
    }
    const stock = await this.inventory.setLowStockThreshold(id, threshold, warehouseId);
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'inventory.threshold',
      entityType: 'product',
      entityId: id,
      changes: { threshold, warehouseId },
    });
    return stock;
  }

  async movements(
    id: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AdminInventoryMovement>> {
    const [rows, total] = await this.inventory.movements(id, page, pageSize);
    return {
      items: rows.map((m) => ({
        id: m.id,
        type: m.type,
        warehouse: m.warehouse,
        quantityChange: m.quantityChange,
        reservedChange: m.reservedChange,
        quantityAfter: m.quantityAfter,
        reservedAfter: m.reservedAfter,
        orderNumber: m.order?.orderNumber ?? null,
        note: m.note,
        createdBy: m.createdBy ? `${m.createdBy.firstName} ${m.createdBy.lastName}` : null,
        createdAt: m.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // ─────────────────────────────── Yordamchi ───────────────────────────────

  /** Qidiruv matni yangilanadi va katalog keshlari tozalanadi. */
  private async afterChange(productId: string): Promise<void> {
    await this.searchText.refresh({ id: productId });
    this.cache.invalidate();
  }

  private async assertReferences(input: {
    brandId?: string;
    categoryId?: string;
    materialId?: string | null;
    groupId?: string | null;
  }): Promise<void> {
    const checks: Array<[string, Promise<number>, string]> = [];
    if (input.brandId) {
      checks.push([
        'brandId',
        this.prisma.brand.count({ where: { id: input.brandId } }),
        'Brend topilmadi',
      ]);
    }
    if (input.categoryId) {
      checks.push([
        'categoryId',
        this.prisma.category.count({ where: { id: input.categoryId } }),
        'Kategoriya topilmadi',
      ]);
    }
    if (input.materialId) {
      checks.push([
        'materialId',
        this.prisma.material.count({ where: { id: input.materialId } }),
        'Material topilmadi',
      ]);
    }
    if (input.groupId) {
      checks.push([
        'groupId',
        this.prisma.productGroup.count({ where: { id: input.groupId } }),
        'Guruh topilmadi',
      ]);
    }
    const counts = await Promise.all(checks.map(([, count]) => count));
    const errors = checks
      .filter((_, index) => counts[index] === 0)
      .map(([field, , message]) => ({ field, message }));
    if (errors.length > 0) {
      throw ApiError.badRequest('INVALID_REFERENCE', 'Bog‘langan ma’lumot topilmadi', { errors });
    }
  }

  private async assertSkuFree(sku: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.product.findFirst({
      where: {
        sku: { equals: sku, mode: 'insensitive' },
        id: exceptId ? { not: exceptId } : undefined,
      },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.field(
        HttpStatus.CONFLICT,
        'SKU_TAKEN',
        'sku',
        'Bunday SKU li mahsulot mavjud',
      );
    }
  }

  private mapUniqueError(error: unknown): unknown {
    const target = uniqueViolationTarget(error);
    if (target.some((t) => t.includes('sku'))) {
      return ApiError.field(
        HttpStatus.CONFLICT,
        'SKU_TAKEN',
        'sku',
        'Bunday SKU li mahsulot mavjud',
      );
    }
    if (target.some((t) => t.includes('slug'))) {
      return ApiError.field(HttpStatus.CONFLICT, 'SLUG_TAKEN', 'slug', 'Bu manzil (slug) band');
    }
    return error;
  }

  private slugFor(
    explicit: string | undefined,
    source: string,
    exceptId?: string,
  ): Promise<string> {
    return resolveSlug({
      explicit,
      source,
      maxLength: 220,
      isTaken: async (slug) =>
        (await this.prisma.product.count({
          where: { slug, id: exceptId ? { not: exceptId } : undefined },
        })) > 0,
    });
  }

  /** Xususiyat kalitlari va qiymat turlarini tekshiradi: "25" (matn) NUMBER uchun 25 ga aylanadi. */
  private async resolveAttributes(inputs: AttributeInput[]): Promise<ResolvedAttributeValue[]> {
    const attributes = await this.prisma.attribute.findMany({
      where: { key: { in: inputs.map((i) => i.key) } },
    });
    const byKey = new Map(attributes.map((a) => [a.key, a]));
    const errors: { field: string; message: string }[] = [];
    const seen = new Set<string>();
    const result: ResolvedAttributeValue[] = [];

    inputs.forEach((input, index) => {
      const field = `attributes.${index}.value`;
      const attribute = byKey.get(input.key);
      if (!attribute) {
        errors.push({
          field: `attributes.${index}.key`,
          message: `Noma’lum xususiyat: ${input.key}`,
        });
        return;
      }
      if (seen.has(attribute.id)) {
        errors.push({ field: `attributes.${index}.key`, message: 'Xususiyat takrorlangan' });
        return;
      }
      seen.add(attribute.id);
      const value = input.value;
      if (value === null || value === '') {
        result.push({ attributeId: attribute.id, data: null });
        return;
      }
      switch (attribute.type) {
        case 'NUMBER': {
          const number =
            typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
          if (typeof value === 'boolean' || !Number.isFinite(number)) {
            errors.push({ field, message: `${attribute.name}: son kiriting` });
            return;
          }
          result.push({
            attributeId: attribute.id,
            data: { numberValue: number, textValue: null, booleanValue: null },
          });
          return;
        }
        case 'TEXT':
          result.push({
            attributeId: attribute.id,
            data: { numberValue: null, textValue: String(value).trim(), booleanValue: null },
          });
          return;
        case 'BOOLEAN': {
          const bool =
            typeof value === 'boolean'
              ? value
              : ['true', '1', 'ha'].includes(String(value).toLowerCase());
          result.push({
            attributeId: attribute.id,
            data: { numberValue: null, textValue: null, booleanValue: bool },
          });
        }
      }
    });
    if (errors.length > 0) {
      throw ApiError.badRequest('VALIDATION_ERROR', 'Xususiyatlar noto‘g‘ri to‘ldirilgan', {
        errors,
      });
    }
    return result;
  }

  private async writeAttributes(
    tx: Prisma.TransactionClient,
    productId: string,
    values: ResolvedAttributeValue[],
  ): Promise<void> {
    for (const value of values) {
      if (value.data === null) {
        await tx.productAttributeValue.deleteMany({
          where: { productId, attributeId: value.attributeId },
        });
      } else {
        await tx.productAttributeValue.upsert({
          where: { productId_attributeId: { productId, attributeId: value.attributeId } },
          update: value.data,
          create: { productId, attributeId: value.attributeId, ...value.data },
        });
      }
    }
  }

  private async reservedByProduct(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.inventory.groupBy({
      by: ['productId'],
      where: { productId: { in: ids } },
      _sum: { reserved: true },
    });
    return new Map(rows.map((r) => [r.productId, r._sum.reserved ?? 0]));
  }

  private listItem(row: ListRow, reservedStock: number): AdminProductListItem {
    const image = row.images[0];
    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      slug: row.slug,
      brand: row.brand,
      category: row.category,
      material: row.material,
      thumbUrl: image ? this.media.url(image.thumbUrl ?? image.url) : null,
      unit: row.unit,
      basePrice: row.basePrice,
      currentPrice: row.currentPrice,
      discountPercent: discountPercentOf(row.basePrice, row.currentPrice),
      availableStock: row.availableStock,
      reservedStock,
      soldCount: row.soldCount,
      isActive: row.isActive,
      isFeatured: row.isFeatured,
      lowStock: row.availableStock > 0 && row.availableStock <= LOW_STOCK_DISPLAY_THRESHOLD,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private imageDto(image: {
    id: string;
    url: string;
    mediumUrl: string | null;
    thumbUrl: string | null;
    alt: string | null;
    isMain: boolean;
    sortOrder: number;
    width: number | null;
    height: number | null;
  }): AdminProductImage {
    const urls = this.media.imageUrls(image);
    return {
      id: image.id,
      url: urls.url,
      medium: urls.medium,
      thumb: urls.thumb,
      alt: image.alt,
      isMain: image.isMain,
      sortOrder: image.sortOrder,
      width: image.width,
      height: image.height,
    };
  }
}
