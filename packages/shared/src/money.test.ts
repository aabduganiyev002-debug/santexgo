import { describe, expect, it } from 'vitest';
import { assertSom, formatSom, isValidSom } from './money.js';

const NBSP = ' ';

describe('formatSom', () => {
  it("raqamlarni guruhlab, so'm bilan chiqaradi", () => {
    expect(formatSom(45_000)).toBe(`45${NBSP}000${NBSP}so‘m`);
    expect(formatSom(1_250_000)).toBe(`1${NBSP}250${NBSP}000${NBSP}so‘m`);
    expect(formatSom(500)).toBe(`500${NBSP}so‘m`);
    expect(formatSom(0)).toBe(`0${NBSP}so‘m`);
  });

  it('valyutasiz va manfiy qiymatlar', () => {
    expect(formatSom(85_000, { withCurrency: false })).toBe(`85${NBSP}000`);
    expect(formatSom(-15_000)).toBe(`−15${NBSP}000${NBSP}so‘m`);
  });
});

describe('isValidSom / assertSom', () => {
  it('faqat manfiy bo‘lmagan butun sonlarni qabul qiladi', () => {
    expect(isValidSom(0)).toBe(true);
    expect(isValidSom(50_000)).toBe(true);
    expect(isValidSom(-1)).toBe(false);
    expect(isValidSom(1.5)).toBe(false);
    expect(isValidSom(Number.NaN)).toBe(false);
    expect(() => assertSom(-5)).toThrow(RangeError);
  });
});
