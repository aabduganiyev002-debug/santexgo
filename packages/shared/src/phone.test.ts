import { describe, expect, it } from 'vitest';
import { formatUzPhone, isValidUzPhone, maskUzPhone, normalizeUzPhone } from './phone.js';

describe('normalizeUzPhone', () => {
  it('turli yozilishlarni yagona formatga keltiradi', () => {
    expect(normalizeUzPhone('+998901234567')).toBe('+998901234567');
    expect(normalizeUzPhone('998901234567')).toBe('+998901234567');
    expect(normalizeUzPhone('90 123 45 67')).toBe('+998901234567');
    expect(normalizeUzPhone('+998 (90) 123-45-67')).toBe('+998901234567');
  });

  it('noto‘g‘ri raqamlarni rad etadi', () => {
    expect(normalizeUzPhone('12345')).toBeNull();
    expect(normalizeUzPhone('+79001234567')).toBeNull();
    expect(normalizeUzPhone('+998001234567')).toBeNull();
    expect(normalizeUzPhone('')).toBeNull();
    expect(isValidUzPhone('+99890123456')).toBe(false);
  });
});

describe('formatUzPhone / maskUzPhone', () => {
  it('raqamni o‘qishga qulay qiladi', () => {
    expect(formatUzPhone('+998901234567')).toBe('+998 90 123 45 67');
    expect(formatUzPhone('noto‘g‘ri')).toBe('noto‘g‘ri');
  });

  it('raqamning o‘rtasini yashiradi', () => {
    expect(maskUzPhone('+998901234567')).toBe('+998 90 *** ** 67');
    expect(maskUzPhone('abc')).toBe('***');
  });
});
