import { describe, expect, it } from 'vitest';
import {
  applyDiscount,
  calculatePrice,
  discountPercentOf,
  isDiscountActive,
  validateDiscountRule,
} from './discount.js';

describe('applyDiscount', () => {
  it("foizli chegirma: 100 000 so'm − 15% = 85 000", () => {
    expect(applyDiscount(100_000, { type: 'PERCENT', value: 15 })).toBe(85_000);
  });

  it("talabdagi misol: 50 000 so'm − 10% = 45 000", () => {
    expect(applyDiscount(50_000, { type: 'PERCENT', value: 10 })).toBe(45_000);
  });

  it('summali chegirma: 100 000 − 20 000 = 80 000', () => {
    expect(applyDiscount(100_000, { type: 'FIXED', value: 20_000 })).toBe(80_000);
  });

  it('narx hech qachon 0 dan pastga tushmaydi', () => {
    expect(applyDiscount(5_000, { type: 'FIXED', value: 20_000 })).toBe(0);
    expect(applyDiscount(5_000, { type: 'PERCENT', value: 100 })).toBe(0);
  });

  it("natija butun so'mga yaxlitlanadi", () => {
    // 33 333 × 15% = 4 999.95 → 5 000 chegirma
    expect(applyDiscount(33_333, { type: 'PERCENT', value: 15 })).toBe(28_333);
  });

  it("noto'g'ri qiymatlarni rad etadi", () => {
    expect(() => applyDiscount(-1, { type: 'FIXED', value: 1 })).toThrow(RangeError);
    expect(() => applyDiscount(100.5, { type: 'FIXED', value: 1 })).toThrow(RangeError);
    expect(() => validateDiscountRule({ type: 'PERCENT', value: 101 })).toThrow(RangeError);
    expect(() => validateDiscountRule({ type: 'PERCENT', value: 0 })).toThrow(RangeError);
    expect(() => validateDiscountRule({ type: 'FIXED', value: 1.5 })).toThrow(RangeError);
  });
});

describe('calculatePrice', () => {
  it('chegirma bo‘lmasa asosiy narx qaytadi', () => {
    expect(calculatePrice(50_000, [])).toEqual({
      basePrice: 50_000,
      finalPrice: 50_000,
      discountAmount: 0,
      discountPercent: 0,
      discountId: null,
    });
  });

  it('mijoz uchun eng foydali chegirmani tanlaydi, ustma-ust qo‘shmaydi', () => {
    const result = calculatePrice(100_000, [
      { id: 'brand-10', type: 'PERCENT', value: 10 },
      { id: 'fixed-20k', type: 'FIXED', value: 20_000 },
      { id: 'category-15', type: 'PERCENT', value: 15 },
    ]);
    expect(result).toEqual({
      basePrice: 100_000,
      finalPrice: 80_000,
      discountAmount: 20_000,
      discountPercent: 20,
      discountId: 'fixed-20k',
    });
  });

  it('teng natijada priority kattasi tanlanadi', () => {
    const result = calculatePrice(100_000, [
      { id: 'low', type: 'PERCENT', value: 10, priority: 1 },
      { id: 'high', type: 'FIXED', value: 10_000, priority: 5 },
    ]);
    expect(result.discountId).toBe('high');
  });

  it('summali chegirmada ham foiz hisoblanadi', () => {
    expect(
      calculatePrice(89_000, [{ id: 'x', type: 'FIXED', value: 10_000 }]).discountPercent,
    ).toBe(11);
  });
});

describe('discountPercentOf', () => {
  it('foizni yaxlitlab qaytaradi', () => {
    expect(discountPercentOf(100_000, 85_000)).toBe(15);
    expect(discountPercentOf(0, 0)).toBe(0);
    expect(discountPercentOf(100, 120)).toBe(0);
  });
});

describe('isDiscountActive', () => {
  const now = new Date('2026-10-05T12:00:00Z');

  it('boshlangan va tugamagan chegirma amalda', () => {
    expect(
      isDiscountActive(
        { isActive: true, startsAt: new Date('2026-10-01'), endsAt: new Date('2026-10-31') },
        now,
      ),
    ).toBe(true);
  });

  it('muddatsiz chegirma amalda', () => {
    expect(
      isDiscountActive({ isActive: true, startsAt: new Date('2026-10-01'), endsAt: null }, now),
    ).toBe(true);
  });

  it('hali boshlanmagan, tugagan yoki o‘chirilgan chegirma amalda emas', () => {
    expect(
      isDiscountActive({ isActive: true, startsAt: new Date('2026-10-06'), endsAt: null }, now),
    ).toBe(false);
    expect(
      isDiscountActive(
        {
          isActive: true,
          startsAt: new Date('2026-09-01'),
          endsAt: new Date('2026-10-05T12:00:00Z'),
        },
        now,
      ),
    ).toBe(false);
    expect(
      isDiscountActive({ isActive: false, startsAt: new Date('2026-10-01'), endsAt: null }, now),
    ).toBe(false);
  });
});
