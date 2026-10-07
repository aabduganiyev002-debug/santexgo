import type { CartLineView } from '@santexgo/shared';
import { describe, expect, it } from 'vitest';
import { lineIssue, mergeLines, summarize } from './cart-calculator.js';

const DELIVERY = { baseFee: 30_000, freeFrom: 1_000_000, pickupEnabled: true };

function line(quantity: number, price: number, issue: CartLineView['issue'] = null, base = price) {
  return {
    quantity,
    lineBase: base * quantity,
    lineTotal: price * quantity,
    issue,
  } as CartLineView;
}

describe('savatcha hisobi', () => {
  it('bir xil mahsulot qatorlari qo‘shiladi, tartib saqlanadi', () => {
    expect(
      mergeLines([
        { productId: 'b', quantity: 2 },
        { productId: 'a', quantity: 1 },
        { productId: 'b', quantity: 3 },
      ]),
    ).toEqual([
      { productId: 'b', quantity: 5 },
      { productId: 'a', quantity: 1 },
    ]);
  });

  it('qator muammolari', () => {
    expect(lineIssue(1, 0, 1)).toBe('OUT_OF_STOCK');
    expect(lineIssue(5, 3, 1)).toBe('INSUFFICIENT_STOCK');
    expect(lineIssue(1, 3, 2)).toBe('BELOW_MIN');
    expect(lineIssue(3, 3, 2)).toBeNull();
  });

  it('sotuvda yo‘q qatorlar summaga kirmaydi; chegirma va yetkazib berish', () => {
    const summary = summarize(
      [line(2, 85_000, null, 100_000), line(1, 50_000, 'OUT_OF_STOCK')],
      DELIVERY,
      'DELIVERY',
    );
    expect(summary).toEqual({
      itemsCount: 2,
      linesCount: 1,
      subtotal: 200_000,
      discountTotal: 30_000,
      itemsTotal: 170_000,
      deliveryFee: 30_000,
      total: 200_000,
      freeDeliveryFrom: 1_000_000,
      freeDeliveryRemaining: 830_000,
    });
  });

  it('chegaradan oshsa yetkazib berish bepul; olib ketishda va bo‘sh savatchada 0', () => {
    expect(summarize([line(10, 100_000)], DELIVERY, 'DELIVERY').deliveryFee).toBe(0);
    expect(summarize([line(1, 100_000)], DELIVERY, 'PICKUP')).toMatchObject({
      deliveryFee: 0,
      freeDeliveryFrom: null,
      freeDeliveryRemaining: 0,
    });
    expect(summarize([], DELIVERY, 'DELIVERY').total).toBe(0);
  });
});
