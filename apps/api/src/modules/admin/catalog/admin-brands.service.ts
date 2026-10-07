import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type AdminBrand,
  brandInputSchema,
  type brandUpdateSchema,
  type z,
} from '@santexgo/shared';
import type { ActorContext } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { resolveSlug } from '../../../common/utils/unique-slug.js';
import type { Brand } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { MediaService } from '../../../infra/storage/media.service.js';
import { AuditService, diffChanges } from '../../audit/audit.service.js';
import { CatalogCacheService } from '../../catalog/catalog-cache.service.js';
import { SearchTextService } from '../../catalog/search-text.service.js';

type BrandCreate = z.output<typeof brandInputSchema>;
type BrandUpdate = z.output<typeof brandUpdateSchema>;

const LOGO_SIZE = 600;

@Injectable()
export class AdminBrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly cache: CatalogCacheService,
    private readonly searchText: SearchTextService,
  ) {}

  async list(): Promise<AdminBrand[]> {
    const brands = await this.prisma.brand.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return brands.map((b) => this.toDto(b, b._count.products));
  }

  async get(id: string): Promise<AdminBrand> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw ApiError.notFound('Brend topilmadi');
    return this.toDto(brand, brand._count.products);
  }

  async create(input: BrandCreate, actor: ActorContext): Promise<AdminBrand> {
    await this.assertNameFree(input.name);
    const slug = await this.slugFor(input.slug ?? input.name, input.slug !== undefined);
    const brand = await this.prisma.brand.create({
      data: {
        name: input.name,
        slug,
        description: input.description ?? null,
        country: input.country ?? null,
        website: input.website ?? null,
        sortOrder: input.sortOrder,
        isFeatured: input.isFeatured,
        isActive: input.isActive,
      },
    });
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'brand.create',
      entityType: 'brand',
      entityId: brand.id,
      changes: { name: brand.name, slug: brand.slug },
    });
    return this.toDto(brand, 0);
  }

  async update(id: string, input: BrandUpdate, actor: ActorContext): Promise<AdminBrand> {
    const before = await this.prisma.brand.findUnique({ where: { id } });
    if (!before) throw ApiError.notFound('Brend topilmadi');
    if (input.name && input.name.toLowerCase() !== before.name.toLowerCase()) {
      await this.assertNameFree(input.name, id);
    }
    const slug =
      input.slug && input.slug !== before.slug
        ? await this.slugFor(input.slug, true, id)
        : undefined;

    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        // undefined — o'zgartirilmaydi; bo'sh matn — tozalanadi
        description: 'description' in input ? (input.description ?? null) : undefined,
        country: 'country' in input ? (input.country ?? null) : undefined,
        website: 'website' in input ? (input.website ?? null) : undefined,
        sortOrder: input.sortOrder,
        isFeatured: input.isFeatured,
        isActive: input.isActive,
      },
      include: { _count: { select: { products: true } } },
    });
    this.cache.invalidate();
    if (brand.name !== before.name) await this.searchText.refresh({ brandId: id });
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'brand.update',
      entityType: 'brand',
      entityId: id,
      changes: diffChanges(before, brand),
    });
    return this.toDto(brand, brand._count.products);
  }

  async remove(id: string, actor: ActorContext): Promise<void> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!brand) throw ApiError.notFound('Brend topilmadi');
    if (brand._count.products > 0) {
      throw ApiError.conflict(
        'HAS_DEPENDENCIES',
        `Brendda ${brand._count.products} ta mahsulot bor. Avval mahsulotlarni boshqa brendga o‘tkazing ` +
          'yoki brendni yashiring (faolsizlantiring)',
      );
    }
    await this.prisma.brand.delete({ where: { id } });
    await this.media.remove([brand.logoUrl]);
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'brand.delete',
      entityType: 'brand',
      entityId: id,
      changes: { name: brand.name },
    });
  }

  async uploadLogo(id: string, file: Buffer, actor: ActorContext): Promise<AdminBrand> {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw ApiError.notFound('Brend topilmadi');
    const key = await this.media.saveSingleImage(`brands/${id}`, file, LOGO_SIZE);
    await this.prisma.brand.update({ where: { id }, data: { logoUrl: key } });
    await this.media.remove([brand.logoUrl]);
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'brand.logo_upload',
      entityType: 'brand',
      entityId: id,
    });
    return this.get(id);
  }

  async removeLogo(id: string, actor: ActorContext): Promise<AdminBrand> {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw ApiError.notFound('Brend topilmadi');
    await this.prisma.brand.update({ where: { id }, data: { logoUrl: null } });
    await this.media.remove([brand.logoUrl]);
    this.cache.invalidate();
    await this.audit.log({
      actorId: actor.userId,
      ipAddress: actor.ipAddress,
      action: 'brand.logo_delete',
      entityType: 'brand',
      entityId: id,
    });
    return this.get(id);
  }

  private async assertNameFree(name: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.brand.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        id: exceptId ? { not: exceptId } : undefined,
      },
      select: { id: true },
    });
    if (existing) {
      throw ApiError.field(HttpStatus.CONFLICT, 'CONFLICT', 'name', 'Bunday nomli brend mavjud');
    }
  }

  private slugFor(source: string, explicit: boolean, exceptId?: string): Promise<string> {
    return resolveSlug({
      explicit: explicit ? source : undefined,
      source,
      maxLength: 100,
      isTaken: async (slug) =>
        (await this.prisma.brand.count({
          where: { slug, id: exceptId ? { not: exceptId } : undefined },
        })) > 0,
    });
  }

  private toDto(brand: Brand, productCount: number): AdminBrand {
    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: this.media.urlOrNull(brand.logoUrl),
      description: brand.description,
      country: brand.country,
      website: brand.website,
      sortOrder: brand.sortOrder,
      isFeatured: brand.isFeatured,
      isActive: brand.isActive,
      productCount,
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString(),
    };
  }
}
