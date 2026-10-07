import { calculatePrice, type DiscountRule, type PriceResult } from '@santexgo/shared';

export interface PricingTarget {
  productId: string | null;
  categoryId: string | null;
  brandId: string | null;
}

export interface PricingDiscount {
  id: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  priority: number;
  targets: readonly PricingTarget[];
}

export interface PricingProduct {
  id: string;
  brandId: string;
  categoryId: string;
  basePrice: number;
}

/**
 * Mahsulotga tegishli chegirmalar: mahsulotning o'ziga, brendiga yoki kategoriyasiga
 * (ota-kategoriyaga qo'yilgan chegirma barcha ichki kategoriyalarga ham tegishli).
 */
export function applicableRules(
  product: PricingProduct,
  discounts: readonly PricingDiscount[],
  categoryPath: ReadonlySet<string>,
): DiscountRule[] {
  return discounts
    .filter((discount) =>
      discount.targets.some(
        (target) =>
          target.productId === product.id ||
          target.brandId === product.brandId ||
          (target.categoryId !== null && categoryPath.has(target.categoryId)),
      ),
    )
    .map((discount) => ({
      id: discount.id,
      type: discount.type,
      value: discount.value,
      priority: discount.priority,
    }));
}

/** Mahsulotning yakuniy narxi: eng foydali chegirma (ustma-ust qo'shilmaydi). */
export function priceProduct(
  product: PricingProduct,
  discounts: readonly PricingDiscount[],
  categoryPath: ReadonlySet<string>,
): PriceResult {
  return calculatePrice(product.basePrice, applicableRules(product, discounts, categoryPath));
}
