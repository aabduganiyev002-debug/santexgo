import { Injectable } from '@nestjs/common';
import {
  type FavoriteIds,
  MAX_FAVORITES,
  type Paginated,
  type ProductCard,
} from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CARD_SELECT, ProductCardMapper } from '../catalog/product-card.mapper.js';

/** Sevimlilar: mijoz yoqtirgan mahsulotlar (yurakcha). */
@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: ProductCardMapper,
  ) {}

  async list(userId: string, page: number, pageSize: number): Promise<Paginated<ProductCard>> {
    // Sotuvdan olingan mahsulotlar ko'rsatilmaydi (qayta sotuvga chiqsa — yana ko'rinadi)
    const where: Prisma.FavoriteWhereInput = {
      userId,
      product: { isActive: true, brand: { isActive: true } },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { product: { select: CARD_SELECT } },
      }),
      this.prisma.favorite.count({ where }),
    ]);
    const now = Date.now();
    return {
      items: rows.map((row) => this.cards.toCard(row.product, now)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async ids(userId: string): Promise<FavoriteIds> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { productId: true },
    });
    return { productIds: rows.map((row) => row.productId) };
  }

  async add(userId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true },
      select: { id: true },
    });
    if (!product) throw ApiError.notFound('Mahsulot topilmadi');
    if ((await this.prisma.favorite.count({ where: { userId } })) >= MAX_FAVORITES) {
      throw ApiError.badRequest(
        'BAD_REQUEST',
        `Sevimlilarda ${MAX_FAVORITES} tadan ortiq mahsulot bo‘lmasligi kerak`,
      );
    }
    await this.prisma.favorite.createMany({ data: [{ userId, productId }], skipDuplicates: true });
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, productId } });
  }
}
