import { describe, expect, it } from 'vitest';
import { discountInputSchema, discountStatus, discountUpdateSchema } from './discount-admin.js';

const uuid = '01a11522-32e2-712b-985b-568c1b38a2bc';

describe('chegirma sxemasi', () => {
  it('to‘g‘ri chegirmani qabul qiladi', () => {
    const result = discountInputSchema.parse({
      name: 'Kuzgi aksiya',
      type: 'PERCENT',
      value: '15',
      startsAt: '2026-10-01T00:00:00+05:00',
      endsAt: '2026-10-31T23:59:59+05:00',
      targets: { brandIds: [uuid] },
    });
    expect(result.value).toBe(15);
    expect(result.startsAt).toBeInstanceOf(Date);
  });

  it('foiz 100 dan katta, tugash boshlanishdan oldin va bo‘sh targets — xato', () => {
    const errors = discountInputSchema
      .safeParse({
        name: 'X',
        type: 'PERCENT',
        value: 120,
        startsAt: '2026-10-10',
        endsAt: '2026-10-01',
      })
      .error!.issues.map((i) => i.path.join('.'));
    expect(errors.sort()).toEqual(['endsAt', 'targets', 'value']);
  });

  it('summali chegirma 100 dan katta bo‘lishi mumkin', () => {
    expect(
      discountInputSchema.safeParse({
        name: 'X',
        type: 'FIXED',
        value: 10_000,
        targets: { productIds: [uuid] },
      }).success,
    ).toBe(true);
  });

  it('tahrirlashda berilmagan maydonlar qo‘shilmaydi', () => {
    expect(discountUpdateSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });
});

describe('discountStatus', () => {
  const now = new Date('2026-10-07T12:00:00Z');
  it('holatlar', () => {
    const base = { isActive: true, startsAt: new Date('2026-10-01'), endsAt: null };
    expect(discountStatus(base, now)).toBe('active');
    expect(discountStatus({ ...base, isActive: false }, now)).toBe('disabled');
    expect(discountStatus({ ...base, startsAt: new Date('2026-10-08') }, now)).toBe('scheduled');
    expect(discountStatus({ ...base, endsAt: new Date('2026-10-07T11:00:00Z') }, now)).toBe(
      'expired',
    );
  });
});
