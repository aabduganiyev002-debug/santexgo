import { describe, expect, it } from 'vitest';
import {
  adminOrderUpdateSchema,
  cartItemsSchema,
  checkoutFormSchema,
  checkoutSchema,
} from './order.js';

const BASE = {
  firstName: 'Alisher',
  lastName: 'Karimov',
  phone: '90 123 45 67',
  paymentMethod: 'CASH',
};
const ADDRESS = { region: 'Toshkent shahri', district: 'Chilonzor', street: 'Bunyodkor 1' };
const ITEM = { productId: '01a11522-32e2-712b-985b-000000000001', quantity: 2 };

describe('checkout sxemasi', () => {
  it('yetkazib berishda manzil majburiy, olib ketishda — yo‘q', () => {
    const missing = checkoutFormSchema.safeParse({ ...BASE, deliveryMethod: 'DELIVERY' });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(['address']);
    expect(checkoutFormSchema.safeParse({ ...BASE, deliveryMethod: 'PICKUP' }).success).toBe(true);
    expect(
      checkoutFormSchema.safeParse({ ...BASE, deliveryMethod: 'DELIVERY', address: ADDRESS })
        .success,
    ).toBe(true);
  });

  it('telefon normallashtiriladi, bo‘sh izoh olib tashlanadi', () => {
    const data = checkoutFormSchema.parse({ ...BASE, deliveryMethod: 'PICKUP', comment: '  ' });
    expect(data.phone).toBe('+998901234567');
    expect(data.comment).toBeUndefined();
  });

  it('API: mahsulotlar va idempotentlik kaliti talab qilinadi', () => {
    const input = { ...BASE, deliveryMethod: 'PICKUP' };
    expect(checkoutSchema.safeParse(input).success).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...input, items: [], idempotencyKey: crypto.randomUUID() })
        .success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...input, items: [ITEM], idempotencyKey: crypto.randomUUID() })
        .success,
    ).toBe(true);
  });
});

describe('savatcha va admin sxemalari', () => {
  it('miqdor butun va musbat', () => {
    expect(cartItemsSchema.safeParse({ items: [{ ...ITEM, quantity: 0 }] }).success).toBe(false);
    expect(cartItemsSchema.safeParse({ items: [{ ...ITEM, quantity: 1.5 }] }).success).toBe(false);
    expect(cartItemsSchema.safeParse({ items: [ITEM] }).success).toBe(true);
  });

  it('admin o‘zgartirishida kamida bitta maydon bo‘lishi kerak', () => {
    expect(adminOrderUpdateSchema.safeParse({}).success).toBe(false);
    expect(adminOrderUpdateSchema.safeParse({ adminNote: '' }).success).toBe(true);
    expect(adminOrderUpdateSchema.safeParse({ paymentStatus: 'FAILED' }).success).toBe(false);
  });
});
