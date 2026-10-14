import { describe, expect, it } from 'vitest';
import { applicableRules, priceProduct, type PricingDiscount } from './pricing.calculator.js';

const product = { id: 'p1', brandId: 'plastherm', categoryId: 'tirsaklar', basePrice: 100_000 };
const path = new Set(['fittinglar', 'tirsaklar']);

const discounts: PricingDiscount[] = [
  {
    id: 'brand-10',
    type: 'PERCENT',
    value: 10,
    priority: 0,
    targets: [{ productId: null, categoryId: null, brandId: 'plastherm' }],
  },
  {
    id: 'parent-category-15',
    type: 'PERCENT',
    value: 15,
    priority: 0,
    targets: [{ productId: null, categoryId: 'fittinglar', brandId: null }],
  },
  {
    id: 'other-product',
    type: 'FIXED',
    value: 50_000,
    priority: 0,
    targets: [{ productId: 'p2', categoryId: null, brandId: null }],
  },
];

describe('narx hisoblash', () => {
  it('mahsulot, brend va ota-kategoriya chegirmalarini topadi', () => {
    expect(applicableRules(product, discounts, path).map((r) => r.id)).toEqual([
      'brand-10',
      'parent-category-15',
    ]);
  });

  it('eng foydalisini tanlaydi: 100 000 − 15% = 85 000', () => {
    expect(priceProduct(product, discounts, path)).toMatchObject({
      finalPrice: 85_000,
      discountPercent: 15,
      discountId: 'parent-category-15',
    });
  });

  it('chegirma bo‘lmasa narx o‘zgarmaydi', () => {
    expect(
      priceProduct({ ...product, brandId: 'vero' }, discounts, new Set(['trubalar'])),
    ).toMatchObject({ finalPrice: 100_000, discountId: null });
  });
});
