import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AdminDiscountDetail,
  type AdminDiscountListItem,
  type AdminDiscountProduct,
  applyDiscount,
  type discountInputSchema,
  type discountListQuerySchema,
  discountStatus,
  type discountUpdateSchema,
  type Paginated,
  type z,
} from '@santexgo/shared';
import type { ActorContext } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { AuditService, diffChanges } from '../../audit/audit.service.js';
import { CatalogCacheService } from '../../catalog/catalog-cache.service.js';
import { PricingService } from '../../pricing/pricing.service.js';

type DiscountCreate = z.output<typeof discountInputSchema>;
type DiscountUpdate = z.output<typeof discountUpdateSchema>;
type ListQuery = z.output<typeof discountListQuerySchema>;
type Targets = NonNullable<DiscountCreate['targets']>;

const INCLUDE = {
  targets: {
    include: {
      product: { select: { id: true, sku: true, name: true } },
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
    },
  },
  createdBy: { select: { firstName: true, lastName: true } },
  _count: { select: { appliedProducts: true } },
} satisfies Prisma.DiscountInclude;

type DiscountRow = Prisma.DiscountGetPayload<{ include: typeof INCLUDE }>;

/**
 * Admin: chegirmalar. Har bir o'zgarishdan keyin barcha mahsulotlarning narxi qayta hisoblanadi
 * (mijoz uchun eng foydali chegirma tanlanadi, ustma-ust qo'shilmaydi).
 */
@Injectable()
export class AdminDiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly cache: CatalogCacheService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListQuery): Promise<Paginated<AdminDiscountListItem>> {
    const now = new Date();
    const and: Prisma.DiscountWhereInput[] = [];
    if (query.q) and.push({ name: { contains: query.q, mode: 'insensitive' } });
    switch (query.status) {
      case 'active':
        and.push({
          isActive: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        });
        break;
      case 'scheduled':
        and.push({ isActive: true, startsAt: { gt: now } });
        break;
      case 'expired':
        and.push({ isActive: true, endsAt: { lte: now } });
        break;
      case 'disabled':
        and.push({ isActive: false });
        break;
    }
    const where: Prisma.DiscountWhereInput = and.length > 0 ? { AND: and } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.discount.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: INCLUDE,
      }),
      this.prisma.discount.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.listItem(row, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async get(id: string): Promise<AdminDiscountDetail> {
    const row = await this.prisma.discount.findUnique({ where: { id }, include: INCLUDE });
    if (!row) throw ApiError.notFound('Chegirma topilmadi');
    const tree = await this.cache.categoryTree();
    return {
      ...this.listItem(row),
      targetProducts: row.targets.flatMap((t) => (t.product ? [t.product] : [])),
      targetCategories: row.targets.flatMap((t) =>
        t.category
          ? [
              {
                id: t.category.id,
                name: t.category.name,
                path: tree
                  .path(t.category.id)
                  .map((c) => c.name)
                  .join(' / '),
              },
            ]
          : [],
      ),
      targetBrands: row.targets.flatMap((t) => (t.brand ? [t.brand] : [])),
    };
  }

  async create(input: DiscountCreate, actor: ActorContext): Promise<AdminDiscountDetail> {
    const targets = await this.validateTargets(input.targets!);
    const discount = await this.prisma.$transaction(async (tx) => {
      const created = await tx.discount.create({
        data: {
          name: input.name,
          type: input.type,
          value: input.value,
          startsAt: input.startsAt ?? new Date(),
          endsAt: input.endsAt ?? null,
          priority: input.priority ?? 0,
          isActive: input.isActive ?? true,
          createdById: actor.userId,
        },
      });
      await this.writeTargets(tx, created.id, targets);
      return created;
    });
    await this.applyPrices();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'discount.create',
      entityType: 'discount',
      entityId: discount.id,
      changes: { ...input, targets },
    });
    return this.get(discount.id);
  }

  async update(
    id: string,
    input: DiscountUpdate,
    actor: ActorContext,
  ): Promise<AdminDiscountDetail> {
    const before = await this.prisma.discount.findUnique({ where: { id } });
    if (!before) throw ApiError.notFound('Chegirma topilmadi');

    // Mavjud qiymatlar bilan birgalikda tekshiriladi (masalan, faqat "value" o'zgarsa ham)
    const type = input.type ?? before.type;
    const value = input.value ?? before.value;
    const startsAt = input.startsAt ?? before.startsAt;
    const endsAt = input.endsAt === undefined ? before.endsAt : input.endsAt;
    if (type === 'PERCENT' && value > 100) {
      throw ApiError.field(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'value',
        'Foiz 100 dan oshmasligi kerak',
      );
    }
    if (endsAt && endsAt <= startsAt) {
      throw ApiError.field(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'endsAt',
        'Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak',
      );
    }
    const targets = input.targets ? await this.validateTargets(input.targets) : null;

    const after = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.discount.update({
        where: { id },
        data: {
          name: input.name,
          type: input.type,
          value: input.value,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          priority: input.priority,
          isActive: input.isActive,
        },
      });
      if (targets) {
        await tx.discountTarget.deleteMany({ where: { discountId: id } });
        await this.writeTargets(tx, id, targets);
      }
      return updated;
    });
    await this.applyPrices();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'discount.update',
      entityType: 'discount',
      entityId: id,
      changes: { ...diffChanges(before, after), ...(targets ? { targets } : {}) },
    });
    return this.get(id);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const discount = await this.prisma.discount.findUnique({ where: { id } });
    if (!discount) throw ApiError.notFound('Chegirma topilmadi');
    // Eski buyurtmalardagi narxlar o'zgarmaydi — ular buyurtma vaqtida "muzlatilgan"
    await this.prisma.discount.delete({ where: { id } });
    await this.applyPrices();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'discount.delete',
      entityType: 'discount',
      entityId: id,
      changes: { name: discount.name, type: discount.type, value: discount.value },
    });
  }

  /** Chegirma tegishli mahsulotlar: narxlar va chegirma haqiqatan qo'llanganmi. */
  async products(
    id: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<AdminDiscountProduct>> {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      include: { targets: true },
    });
    if (!discount) throw ApiError.notFound('Chegirma topilmadi');
    const tree = await this.cache.categoryTree();
    const categoryIds = discount.targets.flatMap((t) =>
      t.categoryId ? tree.descendantIds(t.categoryId, false) : [],
    );
    const or: Prisma.ProductWhereInput[] = [];
    const productIds = discount.targets.flatMap((t) => (t.productId ? [t.productId] : []));
    const brandIds = discount.targets.flatMap((t) => (t.brandId ? [t.brandId] : []));
    if (productIds.length) or.push({ id: { in: productIds } });
    if (brandIds.length) or.push({ brandId: { in: brandIds } });
    if (categoryIds.length) or.push({ categoryId: { in: categoryIds } });
    const where: Prisma.ProductWhereInput = { OR: or.length > 0 ? or : [{ id: { in: [] } }] };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          sku: true,
          name: true,
          basePrice: true,
          currentPrice: true,
          appliedDiscountId: true,
          appliedDiscount: { select: { name: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: rows.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        basePrice: p.basePrice,
        currentPrice: p.currentPrice,
        priceWithThisDiscount: applyDiscount(p.basePrice, discount),
        isApplied: p.appliedDiscountId === id,
        appliedDiscountName: p.appliedDiscount?.name ?? null,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  private async applyPrices(): Promise<void> {
    await this.pricing.recalculate();
    this.cache.invalidate();
  }

  private async validateTargets(targets: Targets): Promise<Required<Targets>> {
    const unique = {
      productIds: [...new Set(targets.productIds ?? [])],
      categoryIds: [...new Set(targets.categoryIds ?? [])],
      brandIds: [...new Set(targets.brandIds ?? [])],
    };
    const [products, categories, brands] = await Promise.all([
      this.prisma.product.count({ where: { id: { in: unique.productIds } } }),
      this.prisma.category.count({ where: { id: { in: unique.categoryIds } } }),
      this.prisma.brand.count({ where: { id: { in: unique.brandIds } } }),
    ]);
    const errors = [];
    if (products !== unique.productIds.length) {
      errors.push({ field: 'targets.productIds', message: 'Ba’zi mahsulotlar topilmadi' });
    }
    if (categories !== unique.categoryIds.length) {
      errors.push({ field: 'targets.categoryIds', message: 'Ba’zi kategoriyalar topilmadi' });
    }
    if (brands !== unique.brandIds.length) {
      errors.push({ field: 'targets.brandIds', message: 'Ba’zi brendlar topilmadi' });
    }
    if (errors.length > 0) {
      throw ApiError.badRequest('INVALID_REFERENCE', 'Tanlangan ma’lumotlar topilmadi', { errors });
    }
    return unique;
  }

  private async writeTargets(
    tx: Prisma.TransactionClient,
    discountId: string,
    targets: Required<Targets>,
  ): Promise<void> {
    await tx.discountTarget.createMany({
      data: [
        ...targets.productIds.map((productId) => ({ discountId, productId })),
        ...targets.categoryIds.map((categoryId) => ({ discountId, categoryId })),
        ...targets.brandIds.map((brandId) => ({ discountId, brandId })),
      ],
    });
  }

  private listItem(row: DiscountRow, now: Date = new Date()): AdminDiscountListItem {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      value: row.value,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      priority: row.priority,
      isActive: row.isActive,
      status: discountStatus(row, now),
      targets: {
        productCount: row.targets.filter((t) => t.productId).length,
        categories: row.targets.flatMap((t) => (t.category ? [t.category.name] : [])),
        brands: row.targets.flatMap((t) => (t.brand ? [t.brand.name] : [])),
      },
      appliedCount: row._count.appliedProducts,
      createdBy: row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}` : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
