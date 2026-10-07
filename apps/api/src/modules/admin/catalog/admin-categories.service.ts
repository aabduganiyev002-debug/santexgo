import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AdminCategory,
  type categoryInputSchema,
  type categoryUpdateSchema,
  type z,
} from '@santexgo/shared';
import type { ActorContext } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { resolveSlug } from '../../../common/utils/unique-slug.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { MediaService } from '../../../infra/storage/media.service.js';
import { AuditService, diffChanges } from '../../audit/audit.service.js';
import { CatalogCacheService } from '../../catalog/catalog-cache.service.js';
import { CategoryTree } from '../../catalog/category-tree.js';
import { SearchTextService } from '../../catalog/search-text.service.js';
import { PricingService } from '../../pricing/pricing.service.js';

type CategoryCreate = z.output<typeof categoryInputSchema>;
type CategoryUpdate = z.output<typeof categoryUpdateSchema>;

const IMAGE_SIZE = 800;

@Injectable()
export class AdminCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly cache: CatalogCacheService,
    private readonly searchText: SearchTextService,
    private readonly pricing: PricingService,
  ) {}

  /** Daraxt tartibida tekis ro'yxat (har birida chuqurlik va to'liq yo'l). */
  async list(): Promise<AdminCategory[]> {
    const [categories, counts, links] = await Promise.all([
      this.prisma.category.findMany(),
      this.prisma.product.groupBy({ by: ['categoryId'], _count: { _all: true } }),
      this.prisma.categoryAttribute.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]);
    const tree = new CategoryTree(categories);
    const direct = new Map(counts.map((c) => [c.categoryId, c._count._all]));
    const totals = tree.rollUp(direct);
    const byId = new Map(categories.map((c) => [c.id, c]));

    const result: AdminCategory[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const node of tree.children(parentId, false)) {
        const category = byId.get(node.id)!;
        result.push({
          id: category.id,
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
          description: category.description,
          imageUrl: this.media.urlOrNull(category.imageUrl),
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          depth,
          path: tree
            .path(category.id)
            .map((c) => c.name)
            .join(' / '),
          productCount: direct.get(category.id) ?? 0,
          totalProductCount: totals.get(category.id) ?? 0,
          childCount: tree.children(category.id, false).length,
          attributeIds: links.filter((l) => l.categoryId === category.id).map((l) => l.attributeId),
        });
        walk(category.id, depth + 1);
      }
    };
    walk(null, 0);
    return result;
  }

  async get(id: string): Promise<AdminCategory> {
    const category = (await this.list()).find((c) => c.id === id);
    if (!category) throw ApiError.notFound('Kategoriya topilmadi');
    return category;
  }

  async create(input: CategoryCreate, actor: ActorContext): Promise<AdminCategory> {
    if (input.parentId) await this.assertExists(input.parentId, 'parentId');
    if (input.attributeIds) await this.assertAttributes(input.attributeIds);
    const slug = await this.slugFor(input.slug, input.name);

    const category = await this.prisma.$transaction(async (tx) => {
      const created = await tx.category.create({
        data: {
          name: input.name,
          slug,
          parentId: input.parentId,
          description: input.description ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
      });
      if (input.attributeIds?.length) {
        await tx.categoryAttribute.createMany({
          data: input.attributeIds.map((attributeId, index) => ({
            categoryId: created.id,
            attributeId,
            sortOrder: index,
          })),
        });
      }
      return created;
    });
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'category.create',
      entityType: 'category',
      entityId: category.id,
      changes: { name: category.name, parentId: category.parentId },
    });
    return this.get(category.id);
  }

  async update(id: string, input: CategoryUpdate, actor: ActorContext): Promise<AdminCategory> {
    const before = await this.prisma.category.findUnique({ where: { id } });
    if (!before) throw ApiError.notFound('Kategoriya topilmadi');

    const parentChanged = input.parentId !== undefined && input.parentId !== before.parentId;
    if (parentChanged && input.parentId) {
      await this.assertExists(input.parentId, 'parentId');
      const tree = new CategoryTree(await this.prisma.category.findMany());
      if (tree.isAncestorOrSelf(id, input.parentId)) {
        throw ApiError.field(
          HttpStatus.BAD_REQUEST,
          'BAD_REQUEST',
          'parentId',
          'Kategoriyani o‘zining ichiga joylab bo‘lmaydi',
        );
      }
    }
    if (input.attributeIds) await this.assertAttributes(input.attributeIds);
    const slug =
      input.slug && input.slug !== before.slug
        ? await this.slugFor(input.slug, input.slug, id)
        : undefined;

    const category = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: {
          name: input.name,
          slug,
          parentId: input.parentId,
          description: 'description' in input ? (input.description ?? null) : undefined,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        },
      });
      // Yashirilgan kategoriyaning ichki kategoriyalari ham yashiriladi
      if (input.isActive === false && before.isActive) {
        const tree = new CategoryTree(await tx.category.findMany());
        const descendants = tree.descendantIds(id, false).filter((cid) => cid !== id);
        if (descendants.length > 0) {
          await tx.category.updateMany({
            where: { id: { in: descendants } },
            data: { isActive: false },
          });
        }
      }
      if (input.attributeIds) {
        await tx.categoryAttribute.deleteMany({ where: { categoryId: id } });
        await tx.categoryAttribute.createMany({
          data: input.attributeIds.map((attributeId, index) => ({
            categoryId: id,
            attributeId,
            sortOrder: index,
          })),
        });
      }
      return updated;
    });

    this.cache.invalidate();
    if (category.name !== before.name || parentChanged) {
      const tree = await this.cache.categoryTree();
      const ids = tree.descendantIds(id, false);
      await this.searchText.refresh({ categoryId: { in: ids } });
      // Ota-kategoriyaga qo'yilgan chegirmalar endi boshqacha tegishli bo'lishi mumkin
      if (parentChanged) {
        const products = await this.prisma.product.findMany({
          where: { categoryId: { in: ids } },
          select: { id: true },
        });
        await this.pricing.recalculate(products.map((p) => p.id));
      }
    }
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'category.update',
      entityType: 'category',
      entityId: id,
      changes: {
        ...diffChanges(before, category),
        ...(input.attributeIds ? { attributeIds: input.attributeIds } : {}),
      },
    });
    return this.get(id);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!category) throw ApiError.notFound('Kategoriya topilmadi');
    if (category._count.children > 0) {
      throw ApiError.conflict(
        'HAS_DEPENDENCIES',
        `Kategoriyada ${category._count.children} ta ichki kategoriya bor. Avval ularni o‘chiring yoki ko‘chiring`,
      );
    }
    if (category._count.products > 0) {
      throw ApiError.conflict(
        'HAS_DEPENDENCIES',
        `Kategoriyada ${category._count.products} ta mahsulot bor. Avval mahsulotlarni boshqa kategoriyaga o‘tkazing ` +
          'yoki kategoriyani yashiring',
      );
    }
    await this.prisma.category.delete({ where: { id } });
    await this.media.remove([category.imageUrl]);
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'category.delete',
      entityType: 'category',
      entityId: id,
      changes: { name: category.name },
    });
  }

  async uploadImage(id: string, file: Buffer, actor: ActorContext): Promise<AdminCategory> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw ApiError.notFound('Kategoriya topilmadi');
    const key = await this.media.saveSingleImage(`categories/${id}`, file, IMAGE_SIZE);
    await this.prisma.category.update({ where: { id }, data: { imageUrl: key } });
    await this.media.remove([category.imageUrl]);
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'category.image_upload',
      entityType: 'category',
      entityId: id,
    });
    return this.get(id);
  }

  async removeImage(id: string, actor: ActorContext): Promise<AdminCategory> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw ApiError.notFound('Kategoriya topilmadi');
    await this.prisma.category.update({ where: { id }, data: { imageUrl: null } });
    await this.media.remove([category.imageUrl]);
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'category.image_delete',
      entityType: 'category',
      entityId: id,
    });
    return this.get(id);
  }

  private async assertExists(id: string, field: string): Promise<void> {
    if ((await this.prisma.category.count({ where: { id } })) === 0) {
      throw ApiError.field(
        HttpStatus.BAD_REQUEST,
        'INVALID_REFERENCE',
        field,
        'Kategoriya topilmadi',
      );
    }
  }

  private async assertAttributes(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length !== ids.length) {
      throw ApiError.field(
        HttpStatus.BAD_REQUEST,
        'BAD_REQUEST',
        'attributeIds',
        'Xususiyatlar takrorlangan',
      );
    }
    if ((await this.prisma.attribute.count({ where: { id: { in: unique } } })) !== unique.length) {
      throw ApiError.field(
        HttpStatus.BAD_REQUEST,
        'INVALID_REFERENCE',
        'attributeIds',
        'Xususiyat topilmadi',
      );
    }
  }

  private slugFor(
    explicit: string | undefined,
    source: string,
    exceptId?: string,
  ): Promise<string> {
    return resolveSlug({
      explicit,
      source,
      maxLength: 120,
      isTaken: async (slug) =>
        (await this.prisma.category.count({
          where: { slug, id: exceptId ? { not: exceptId } : undefined },
        })) > 0,
    });
  }
}
