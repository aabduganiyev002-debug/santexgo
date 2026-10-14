import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AdminAttribute,
  type AdminMaterial,
  type AdminProductGroup,
  type AdminWarehouse,
  type attributeInputSchema,
  type attributeUpdateSchema,
  type materialInputSchema,
  type materialUpdateSchema,
  type productGroupInputSchema,
  type productGroupUpdateSchema,
  type z,
} from '@santexgo/shared';
import type { ActorContext } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { resolveSlug } from '../../../common/utils/unique-slug.js';
import type { Material } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { AuditService, diffChanges } from '../../audit/audit.service.js';
import { CatalogCacheService } from '../../catalog/catalog-cache.service.js';
import { SearchTextService } from '../../catalog/search-text.service.js';

/**
 * Katalogning yordamchi ma'lumotnomalari: materiallar, texnik xususiyatlar,
 * mahsulot guruhlari (o'lcham variantlari) va omborlar ro'yxati.
 */
@Injectable()
export class AdminTaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: CatalogCacheService,
    private readonly searchText: SearchTextService,
  ) {}

  // ─────────────────────────────── Materiallar ───────────────────────────────

  async listMaterials(): Promise<AdminMaterial[]> {
    const materials = await this.prisma.material.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return materials.map((m) => this.materialDto(m, m._count.products));
  }

  async createMaterial(
    input: z.output<typeof materialInputSchema>,
    actor: ActorContext,
  ): Promise<AdminMaterial> {
    await this.assertMaterialNameFree(input.name);
    const slug = await this.materialSlug(input.slug, input.name);
    const material = await this.prisma.material.create({
      data: {
        name: input.name,
        slug,
        fullName: input.fullName ?? null,
        description: input.description ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
    this.cache.invalidate();
    await this.log(actor, 'material.create', 'material', material.id, { name: material.name });
    return this.materialDto(material, 0);
  }

  async updateMaterial(
    id: string,
    input: z.output<typeof materialUpdateSchema>,
    actor: ActorContext,
  ): Promise<AdminMaterial> {
    const before = await this.prisma.material.findUnique({ where: { id } });
    if (!before) throw ApiError.notFound('Material topilmadi');
    if (input.name && input.name.toLowerCase() !== before.name.toLowerCase()) {
      await this.assertMaterialNameFree(input.name, id);
    }
    const slug =
      input.slug && input.slug !== before.slug
        ? await this.materialSlug(input.slug, input.slug, id)
        : undefined;
    const material = await this.prisma.material.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        fullName: 'fullName' in input ? (input.fullName ?? null) : undefined,
        description: 'description' in input ? (input.description ?? null) : undefined,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
      include: { _count: { select: { products: true } } },
    });
    this.cache.invalidate();
    if (material.name !== before.name || material.fullName !== before.fullName) {
      await this.searchText.refresh({ materialId: id });
    }
    await this.log(actor, 'material.update', 'material', id, diffChanges(before, material));
    return this.materialDto(material, material._count.products);
  }

  async removeMaterial(id: string, actor: ActorContext): Promise<void> {
    const material = await this.prisma.material.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!material) throw ApiError.notFound('Material topilmadi');
    if (material._count.products > 0) {
      throw ApiError.conflict(
        'HAS_DEPENDENCIES',
        `Bu material ${material._count.products} ta mahsulotda ishlatilgan. Avval mahsulotlardan olib tashlang yoki yashiring`,
      );
    }
    await this.prisma.material.delete({ where: { id } });
    this.cache.invalidate();
    await this.log(actor, 'material.delete', 'material', id, { name: material.name });
  }

  private materialDto(m: Material, productCount: number): AdminMaterial {
    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      fullName: m.fullName,
      description: m.description,
      sortOrder: m.sortOrder,
      isActive: m.isActive,
      productCount,
    };
  }

  private async assertMaterialNameFree(name: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.material.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        id: exceptId ? { not: exceptId } : undefined,
      },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.field(HttpStatus.CONFLICT, 'CONFLICT', 'name', 'Bunday nomli material mavjud');
    }
  }

  private materialSlug(explicit: string | undefined, source: string, exceptId?: string) {
    return resolveSlug({
      explicit,
      source,
      maxLength: 60,
      isTaken: async (slug) =>
        (await this.prisma.material.count({
          where: { slug, id: exceptId ? { not: exceptId } : undefined },
        })) > 0,
    });
  }

  // ───────────────────────────── Xususiyatlar ─────────────────────────────

  async listAttributes(): Promise<AdminAttribute[]> {
    const attributes = await this.prisma.attribute.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { values: true } },
        categories: { select: { categoryId: true } },
      },
    });
    return attributes.map((a) => ({
      id: a.id,
      key: a.key,
      name: a.name,
      unit: a.unit,
      type: a.type,
      isFilterable: a.isFilterable,
      isVisible: a.isVisible,
      sortOrder: a.sortOrder,
      usageCount: a._count.values,
      categoryIds: a.categories.map((c) => c.categoryId),
    }));
  }

  async createAttribute(
    input: z.output<typeof attributeInputSchema>,
    actor: ActorContext,
  ): Promise<AdminAttribute> {
    if ((await this.prisma.attribute.count({ where: { key: input.key } })) > 0) {
      throw ApiError.field(
        HttpStatus.CONFLICT,
        'CONFLICT',
        'key',
        'Bunday kalitli xususiyat mavjud',
      );
    }
    const attribute = await this.prisma.attribute.create({
      data: {
        key: input.key,
        name: input.name,
        unit: input.unit ?? null,
        type: input.type,
        isFilterable: input.isFilterable,
        isVisible: input.isVisible,
        sortOrder: input.sortOrder,
      },
    });
    this.cache.invalidate();
    await this.log(actor, 'attribute.create', 'attribute', attribute.id, {
      key: attribute.key,
      name: attribute.name,
    });
    return (await this.listAttributes()).find((a) => a.id === attribute.id)!;
  }

  async updateAttribute(
    id: string,
    input: z.output<typeof attributeUpdateSchema>,
    actor: ActorContext,
  ): Promise<AdminAttribute> {
    const before = await this.prisma.attribute.findUnique({ where: { id } });
    if (!before) throw ApiError.notFound('Xususiyat topilmadi');
    const attribute = await this.prisma.attribute.update({
      where: { id },
      data: {
        name: input.name,
        unit: 'unit' in input ? (input.unit ?? null) : undefined,
        isFilterable: input.isFilterable,
        isVisible: input.isVisible,
        sortOrder: input.sortOrder,
      },
    });
    this.cache.invalidate();
    if (attribute.unit !== before.unit) {
      await this.searchText.refresh({ attributeValues: { some: { attributeId: id } } });
    }
    await this.log(actor, 'attribute.update', 'attribute', id, diffChanges(before, attribute));
    return (await this.listAttributes()).find((a) => a.id === id)!;
  }

  async removeAttribute(id: string, actor: ActorContext): Promise<void> {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id },
      include: { _count: { select: { values: true } } },
    });
    if (!attribute) throw ApiError.notFound('Xususiyat topilmadi');
    if (attribute._count.values > 0) {
      throw ApiError.conflict(
        'HAS_DEPENDENCIES',
        `Bu xususiyat ${attribute._count.values} ta mahsulotda to‘ldirilgan. O‘rniga uni yashirish mumkin`,
      );
    }
    await this.prisma.attribute.delete({ where: { id } });
    this.cache.invalidate();
    await this.log(actor, 'attribute.delete', 'attribute', id, { key: attribute.key });
  }

  // ─────────────────────────── Mahsulot guruhlari ───────────────────────────

  async listGroups(q?: string): Promise<AdminProductGroup[]> {
    const groups = await this.prisma.productGroup.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
      take: 200,
      include: { _count: { select: { products: true } } },
    });
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      variantAttributeKey: g.variantAttributeKey,
      productCount: g._count.products,
    }));
  }

  async createGroup(
    input: z.output<typeof productGroupInputSchema>,
    actor: ActorContext,
  ): Promise<AdminProductGroup> {
    await this.assertVariantKey(input.variantAttributeKey ?? null);
    const group = await this.prisma.productGroup.create({
      data: { name: input.name, variantAttributeKey: input.variantAttributeKey ?? null },
    });
    await this.log(actor, 'product_group.create', 'product_group', group.id, { name: group.name });
    return { ...group, productCount: 0 };
  }

  async updateGroup(
    id: string,
    input: z.output<typeof productGroupUpdateSchema>,
    actor: ActorContext,
  ): Promise<AdminProductGroup> {
    const before = await this.prisma.productGroup.findUnique({ where: { id } });
    if (!before) throw ApiError.notFound('Guruh topilmadi');
    if (input.variantAttributeKey !== undefined) {
      await this.assertVariantKey(input.variantAttributeKey);
    }
    const group = await this.prisma.productGroup.update({
      where: { id },
      data: input,
      include: { _count: { select: { products: true } } },
    });
    await this.log(actor, 'product_group.update', 'product_group', id, diffChanges(before, group));
    return {
      id: group.id,
      name: group.name,
      variantAttributeKey: group.variantAttributeKey,
      productCount: group._count.products,
    };
  }

  async removeGroup(id: string, actor: ActorContext): Promise<void> {
    const group = await this.prisma.productGroup.findUnique({ where: { id } });
    if (!group) throw ApiError.notFound('Guruh topilmadi');
    // Mahsulotlar o'chmaydi — faqat guruhdan chiqadi (onDelete: SetNull)
    await this.prisma.productGroup.delete({ where: { id } });
    await this.log(actor, 'product_group.delete', 'product_group', id, { name: group.name });
  }

  private async assertVariantKey(key: string | null): Promise<void> {
    if (key && (await this.prisma.attribute.count({ where: { key } })) === 0) {
      throw ApiError.field(
        HttpStatus.BAD_REQUEST,
        'INVALID_REFERENCE',
        'variantAttributeKey',
        'Bunday kalitli xususiyat yo‘q',
      );
    }
  }

  // ─────────────────────────────── Omborlar ───────────────────────────────

  async listWarehouses(): Promise<AdminWarehouse[]> {
    const warehouses = await this.prisma.warehouse.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return warehouses.map((w) => ({
      id: w.id,
      code: w.code,
      name: w.name,
      address: w.address,
      isDefault: w.isDefault,
      isActive: w.isActive,
    }));
  }

  private log(
    actor: ActorContext,
    action: string,
    entityType: string,
    entityId: string,
    changes: Record<string, unknown>,
  ): Promise<void> {
    return this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action,
      entityType,
      entityId,
      changes,
    });
  }
}
