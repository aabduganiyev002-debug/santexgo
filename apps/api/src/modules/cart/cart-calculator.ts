import { Injectable } from '@nestjs/common';
import {
  type CartIssue,
  type CartLineView,
  type CartSummary,
  type CartView,
  type DeliveryMethod,
  type DeliverySettings,
  deliveryFee,
  MAX_ORDER_QUANTITY,
  type ProductCard,
} from '@santexgo/shared';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CatalogCacheService } from '../catalog/catalog-cache.service.js';
import { CARD_SELECT, ProductCardMapper } from '../catalog/product-card.mapper.js';
import { SettingsService } from '../content/settings.service.js';

export interface CartRequestLine {
  productId: string;
  quantity: number;
}

/** Bir xil mahsulot bir necha marta kelsa — miqdorlar qo'shiladi (birinchi uchragan tartibda). */
export function mergeLines(lines: readonly CartRequestLine[]): CartRequestLine[] {
  const merged = new Map<string, number>();
  for (const line of lines) {
    merged.set(
      line.productId,
      Math.min(MAX_ORDER_QUANTITY, (merged.get(line.productId) ?? 0) + line.quantity),
    );
  }
  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

export function lineIssue(
  quantity: number,
  available: number,
  minOrderQty: number,
): CartIssue | null {
  if (available <= 0) return 'OUT_OF_STOCK';
  if (quantity > available) return 'INSUFFICIENT_STOCK';
  if (quantity < minOrderQty) return 'BELOW_MIN';
  return null;
}

export function buildLine(card: ProductCard, quantity: number): CartLineView {
  const lineBase = card.price.base * quantity;
  const lineTotal = card.price.current * quantity;
  return {
    productId: card.id,
    slug: card.slug,
    sku: card.sku,
    name: card.name,
    brand: card.brand,
    image: card.image,
    unit: card.unit,
    quantity,
    minOrderQty: card.minOrderQty,
    maxQuantity: Math.min(card.stock.available, MAX_ORDER_QUANTITY),
    price: card.price,
    stock: card.stock,
    lineBase,
    lineDiscount: lineBase - lineTotal,
    lineTotal,
    issue: lineIssue(quantity, card.stock.available, card.minOrderQty),
  };
}

/** Summalar: sotuvda yo'q qatorlar hisobga olinmaydi (ular buyurtmaga kirmaydi). */
export function summarize(
  lines: readonly CartLineView[],
  delivery: DeliverySettings,
  method: DeliveryMethod,
): CartSummary {
  const orderable = lines.filter((line) => line.issue !== 'OUT_OF_STOCK');
  const subtotal = orderable.reduce((sum, line) => sum + line.lineBase, 0);
  const itemsTotal = orderable.reduce((sum, line) => sum + line.lineTotal, 0);
  const fee = orderable.length > 0 ? deliveryFee(delivery, itemsTotal, method) : 0;
  return {
    itemsCount: orderable.reduce((sum, line) => sum + line.quantity, 0),
    linesCount: orderable.length,
    subtotal,
    discountTotal: subtotal - itemsTotal,
    itemsTotal,
    deliveryFee: fee,
    total: itemsTotal + fee,
    freeDeliveryFrom: method === 'DELIVERY' ? delivery.freeFrom : null,
    freeDeliveryRemaining:
      method === 'DELIVERY' && delivery.freeFrom !== null
        ? Math.max(0, delivery.freeFrom - itemsTotal)
        : 0,
  };
}

/**
 * Savatchani hisoblaydi: joriy narxlar (chegirma bilan), sotuvdagi qoldiq va
 * yetkazib berish narxi. Ham mehmon (brauzerdagi savatcha), ham tizimga kirgan
 * foydalanuvchi uchun bir xil natija beradi.
 */
@Injectable()
export class CartCalculator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cards: ProductCardMapper,
    private readonly cache: CatalogCacheService,
    private readonly settings: SettingsService,
  ) {}

  async view(
    lines: readonly CartRequestLine[],
    method: DeliveryMethod = 'DELIVERY',
  ): Promise<CartView> {
    const merged = mergeLines(lines);
    const ids = merged.map((line) => line.productId);
    const [rows, tree, delivery] = await Promise.all([
      ids.length > 0
        ? this.prisma.product.findMany({
            where: { id: { in: ids }, isActive: true, brand: { isActive: true } },
            select: { ...CARD_SELECT, categoryId: true },
          })
        : [],
      this.cache.categoryTree(),
      this.settings.delivery(),
    ]);
    const byId = new Map(
      rows.filter((row) => tree.isVisible(row.categoryId)).map((row) => [row.id, row]),
    );

    const now = Date.now();
    const viewLines: CartLineView[] = [];
    const unavailableProductIds: string[] = [];
    for (const line of merged) {
      const row = byId.get(line.productId);
      if (!row) {
        unavailableProductIds.push(line.productId);
        continue;
      }
      viewLines.push(buildLine(this.cards.toCard(row, now), line.quantity));
    }

    return {
      lines: viewLines,
      summary: summarize(viewLines, delivery, method),
      hasIssues: viewLines.some(
        (line) => line.issue === 'INSUFFICIENT_STOCK' || line.issue === 'BELOW_MIN',
      ),
      unavailableProductIds,
    };
  }
}
