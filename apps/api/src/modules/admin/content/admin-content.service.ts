import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AdminBanner,
  type AdminHomeCollection,
  type bannerInputSchema,
  type DeliverySettings,
  type homeCollectionInputSchema,
  type homeCollectionUpdateSchema,
  type SiteSettings,
  type StoreSettings,
  type z,
} from '@santexgo/shared';
import type { ActorContext } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { resolveSlug } from '../../../common/utils/unique-slug.js';
import type { Banner, Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { MediaService } from '../../../infra/storage/media.service.js';
import { AuditService, diffChanges } from '../../audit/audit.service.js';
import { CatalogCacheService } from '../../catalog/catalog-cache.service.js';
import { SettingsService } from '../../content/settings.service.js';

type BannerInput = z.output<typeof bannerInputSchema>;
type CollectionCreate = z.output<typeof homeCollectionInputSchema>;
type CollectionUpdate = z.output<typeof homeCollectionUpdateSchema>;

const BANNER_DESKTOP_SIZE = 1920;
const BANNER_MOBILE_SIZE = 900;
const COLLECTION_IMAGE_SIZE = 400;

const COLLECTION_INCLUDE = {
  material: { select: { name: true } },
  category: { select: { name: true } },
  brand: { select: { name: true } },
} satisfies Prisma.HomeCollectionInclude;

/** Admin: bosh sahifa bannerlari, "Material bo'yicha" tugmalari va sayt sozlamalari. */
@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly cache: CatalogCacheService,
    private readonly settings: SettingsService,
  ) {}

  // ─────────────────────────────── Bannerlar ───────────────────────────────

  async listBanners(): Promise<AdminBanner[]> {
    const banners = await this.prisma.banner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return banners.map((b) => this.bannerDto(b));
  }

  async createBanner(
    input: BannerInput,
    image: Buffer,
    mobileImage: Buffer | undefined,
    actor: ActorContext,
  ): Promise<AdminBanner> {
    const imageKey = await this.media.saveSingleImage('banners', image, BANNER_DESKTOP_SIZE);
    const mobileKey = mobileImage
      ? await this.media.saveSingleImage('banners', mobileImage, BANNER_MOBILE_SIZE)
      : null;
    const banner = await this.prisma.banner.create({
      data: {
        title: input.title ?? null,
        subtitle: input.subtitle ?? null,
        linkUrl: input.linkUrl ?? null,
        imageUrl: imageKey,
        mobileImageUrl: mobileKey,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
      },
    });
    this.cache.invalidate();
    await this.log(actor, 'banner.create', 'banner', banner.id, { title: banner.title });
    return this.bannerDto(banner);
  }

  async updateBanner(
    id: string,
    input: BannerInput,
    images: { image?: Buffer; mobileImage?: Buffer },
    actor: ActorContext,
  ): Promise<AdminBanner> {
    const before = await this.prisma.banner.findUnique({ where: { id } });
    if (!before) throw ApiError.notFound('Banner topilmadi');
    const imageKey = images.image
      ? await this.media.saveSingleImage('banners', images.image, BANNER_DESKTOP_SIZE)
      : undefined;
    const mobileKey = images.mobileImage
      ? await this.media.saveSingleImage('banners', images.mobileImage, BANNER_MOBILE_SIZE)
      : undefined;
    const banner = await this.prisma.banner.update({
      where: { id },
      data: {
        title: 'title' in input ? (input.title ?? null) : undefined,
        subtitle: 'subtitle' in input ? (input.subtitle ?? null) : undefined,
        linkUrl: 'linkUrl' in input ? (input.linkUrl ?? null) : undefined,
        imageUrl: imageKey,
        mobileImageUrl: mobileKey,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    });
    await this.media.remove([
      imageKey ? before.imageUrl : null,
      mobileKey ? before.mobileImageUrl : null,
    ]);
    this.cache.invalidate();
    await this.log(actor, 'banner.update', 'banner', id, diffChanges(before, banner));
    return this.bannerDto(banner);
  }

  async removeBanner(id: string, actor: ActorContext): Promise<void> {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw ApiError.notFound('Banner topilmadi');
    await this.prisma.banner.delete({ where: { id } });
    await this.media.remove([banner.imageUrl, banner.mobileImageUrl]);
    this.cache.invalidate();
    await this.log(actor, 'banner.delete', 'banner', id, { title: banner.title });
  }

  private bannerDto(b: Banner): AdminBanner {
    return {
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      imageUrl: this.media.url(b.imageUrl),
      mobileImageUrl: this.media.urlOrNull(b.mobileImageUrl),
      linkUrl: b.linkUrl,
      sortOrder: b.sortOrder,
      isActive: b.isActive,
      startsAt: b.startsAt?.toISOString() ?? null,
      endsAt: b.endsAt?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
    };
  }

  // ───────────────────────── "Material bo'yicha" tugmalari ─────────────────────────

  async listCollections(): Promise<AdminHomeCollection[]> {
    const rows = await this.prisma.homeCollection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: COLLECTION_INCLUDE,
    });
    return rows.map((row) => this.collectionDto(row));
  }

  async createCollection(
    input: CollectionCreate,
    actor: ActorContext,
  ): Promise<AdminHomeCollection> {
    await this.assertCollectionFilter(input);
    const slug = await this.collectionSlug(input.slug, input.title);
    const row = await this.prisma.homeCollection.create({
      data: {
        title: input.title,
        slug,
        materialId: input.materialId ?? null,
        categoryId: input.categoryId ?? null,
        brandId: input.brandId ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
      include: COLLECTION_INCLUDE,
    });
    this.cache.invalidate();
    await this.log(actor, 'home_collection.create', 'home_collection', row.id, {
      title: row.title,
    });
    return this.collectionDto(row);
  }

  async updateCollection(
    id: string,
    input: CollectionUpdate,
    actor: ActorContext,
  ): Promise<AdminHomeCollection> {
    const before = await this.prisma.homeCollection.findUnique({ where: { id } });
    if (!before) throw ApiError.notFound('Topilmadi');
    await this.assertCollectionFilter({
      materialId: input.materialId === undefined ? before.materialId : input.materialId,
      categoryId: input.categoryId === undefined ? before.categoryId : input.categoryId,
      brandId: input.brandId === undefined ? before.brandId : input.brandId,
    });
    const slug =
      input.slug && input.slug !== before.slug
        ? await this.collectionSlug(input.slug, input.slug, id)
        : undefined;
    const row = await this.prisma.homeCollection.update({
      where: { id },
      data: {
        title: input.title,
        slug,
        materialId: input.materialId,
        categoryId: input.categoryId,
        brandId: input.brandId,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
      include: COLLECTION_INCLUDE,
    });
    this.cache.invalidate();
    await this.log(
      actor,
      'home_collection.update',
      'home_collection',
      id,
      diffChanges(before, row),
    );
    return this.collectionDto(row);
  }

  async removeCollection(id: string, actor: ActorContext): Promise<void> {
    const row = await this.prisma.homeCollection.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound('Topilmadi');
    await this.prisma.homeCollection.delete({ where: { id } });
    await this.media.remove([row.imageUrl]);
    this.cache.invalidate();
    await this.log(actor, 'home_collection.delete', 'home_collection', id, { title: row.title });
  }

  async uploadCollectionImage(
    id: string,
    file: Buffer,
    actor: ActorContext,
  ): Promise<AdminHomeCollection> {
    const before = await this.prisma.homeCollection.findUnique({ where: { id } });
    if (!before) throw ApiError.notFound('Topilmadi');
    const key = await this.media.saveSingleImage('collections', file, COLLECTION_IMAGE_SIZE);
    const row = await this.prisma.homeCollection.update({
      where: { id },
      data: { imageUrl: key },
      include: COLLECTION_INCLUDE,
    });
    await this.media.remove([before.imageUrl]);
    this.cache.invalidate();
    await this.log(actor, 'home_collection.image', 'home_collection', id, {});
    return this.collectionDto(row);
  }

  private async assertCollectionFilter(filter: {
    materialId?: string | null;
    categoryId?: string | null;
    brandId?: string | null;
  }): Promise<void> {
    if (!filter.materialId && !filter.categoryId && !filter.brandId) {
      throw ApiError.field(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        'materialId',
        'Material, kategoriya yoki brenddan kamida bittasini tanlang',
      );
    }
    const errors = [];
    if (
      filter.materialId &&
      (await this.prisma.material.count({ where: { id: filter.materialId } })) === 0
    ) {
      errors.push({ field: 'materialId', message: 'Material topilmadi' });
    }
    if (
      filter.categoryId &&
      (await this.prisma.category.count({ where: { id: filter.categoryId } })) === 0
    ) {
      errors.push({ field: 'categoryId', message: 'Kategoriya topilmadi' });
    }
    if (
      filter.brandId &&
      (await this.prisma.brand.count({ where: { id: filter.brandId } })) === 0
    ) {
      errors.push({ field: 'brandId', message: 'Brend topilmadi' });
    }
    if (errors.length > 0) {
      throw ApiError.badRequest('INVALID_REFERENCE', 'Bog‘langan ma’lumot topilmadi', { errors });
    }
  }

  private collectionSlug(explicit: string | undefined, source: string, exceptId?: string) {
    return resolveSlug({
      explicit,
      source,
      maxLength: 80,
      isTaken: async (slug) =>
        (await this.prisma.homeCollection.count({
          where: { slug, id: exceptId ? { not: exceptId } : undefined },
        })) > 0,
    });
  }

  private collectionDto(
    row: Prisma.HomeCollectionGetPayload<{ include: typeof COLLECTION_INCLUDE }>,
  ): AdminHomeCollection {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      imageUrl: this.media.urlOrNull(row.imageUrl),
      materialId: row.materialId,
      categoryId: row.categoryId,
      brandId: row.brandId,
      filterLabel: [row.material?.name, row.category?.name, row.brand?.name]
        .filter(Boolean)
        .join(' + '),
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    };
  }

  // ─────────────────────────────── Sozlamalar ───────────────────────────────

  async updateStore(store: StoreSettings, actor: ActorContext): Promise<SiteSettings> {
    const before = (await this.settings.get()).store;
    const result = await this.settings.updateStore(store);
    await this.log(
      actor,
      'settings.store',
      'setting',
      'store',
      diffChanges({ ...before }, { ...store }),
    );
    return result;
  }

  async updateDelivery(delivery: DeliverySettings, actor: ActorContext): Promise<SiteSettings> {
    const before = (await this.settings.get()).delivery;
    const result = await this.settings.updateDelivery(delivery);
    await this.log(
      actor,
      'settings.delivery',
      'setting',
      'delivery',
      diffChanges({ ...before }, { ...delivery }),
    );
    return result;
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
