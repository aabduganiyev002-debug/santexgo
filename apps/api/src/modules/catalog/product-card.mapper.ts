import { Injectable } from '@nestjs/common';
import {
  discountPercentOf,
  LOW_STOCK_DISPLAY_THRESHOLD,
  NEW_PRODUCT_DAYS,
  type PriceInfo,
  type ProductCard,
  type StockInfo,
} from '@santexgo/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { MediaService } from '../../infra/storage/media.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const IMAGE_SELECT = {
  url: true,
  mediumUrl: true,
  thumbUrl: true,
  alt: true,
} satisfies Prisma.ProductImageSelect;

/** Asosiy rasm birinchi, keyin tartib bo'yicha */
export const IMAGE_ORDER: Prisma.ProductImageOrderByWithRelationInput[] = [
  { isMain: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

export const CARD_SELECT = {
  id: true,
  slug: true,
  sku: true,
  name: true,
  unit: true,
  minOrderQty: true,
  basePrice: true,
  currentPrice: true,
  availableStock: true,
  createdAt: true,
  ratingAvg: true,
  ratingCount: true,
  brand: { select: { slug: true, name: true } },
  appliedDiscount: { select: { endsAt: true } },
  images: { select: IMAGE_SELECT, orderBy: IMAGE_ORDER, take: 1 },
} satisfies Prisma.ProductSelect;

export type CardRow = Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>;

export function priceInfo(row: {
  basePrice: number;
  currentPrice: number;
  appliedDiscount: { endsAt: Date | null } | null;
}): PriceInfo {
  const discountPercent = discountPercentOf(row.basePrice, row.currentPrice);
  return {
    base: row.basePrice,
    current: row.currentPrice,
    discountPercent,
    discountEndsAt:
      discountPercent > 0 && row.appliedDiscount?.endsAt
        ? row.appliedDiscount.endsAt.toISOString()
        : null,
  };
}

export function stockInfo(available: number): StockInfo {
  return {
    available,
    inStock: available > 0,
    low: available > 0 && available <= LOW_STOCK_DISPLAY_THRESHOLD,
  };
}

/** Bazadagi qatordan mahsulot kartochkasini yasaydi (rasm manzillari to'liq URL'ga aylanadi). */
@Injectable()
export class ProductCardMapper {
  constructor(private readonly media: MediaService) {}

  toCard(row: CardRow, now: number = Date.now()): ProductCard {
    const image = row.images[0];
    return {
      id: row.id,
      slug: row.slug,
      sku: row.sku,
      name: row.name,
      brand: row.brand,
      image: image ? this.media.imageUrls(image) : null,
      unit: row.unit,
      minOrderQty: row.minOrderQty,
      price: priceInfo(row),
      stock: stockInfo(row.availableStock),
      isNew: now - row.createdAt.getTime() < NEW_PRODUCT_DAYS * DAY_MS,
      rating: { average: Math.round(row.ratingAvg * 10) / 10, count: row.ratingCount },
    };
  }
}
