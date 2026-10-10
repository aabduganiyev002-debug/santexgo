import { describe, expect, it } from 'vitest';
import { safeNextPath } from './redirect.js';

describe('safeNextPath', () => {
  it('sayt ichidagi yo‘lni qaytaradi (parametrlar va # bilan)', () => {
    expect(safeNextPath('/account/orders?tab=active#top')).toBe('/account/orders?tab=active#top');
    expect(safeNextPath('/catalog/trubalar?material=ppr')).toBe('/catalog/trubalar?material=ppr');
  });

  it('bo‘sh yoki nisbiy qiymatda fallback', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined, '/account')).toBe('/account');
    expect(safeNextPath('')).toBe('/');
    expect(safeNextPath('account')).toBe('/');
    expect(safeNextPath('https://evil.com')).toBe('/');
    expect(safeNextPath('javascript:alert(1)')).toBe('/');
  });

  it('boshqa saytga olib ketadigan qiymatlarni rad etadi', () => {
    for (const value of [
      '//evil.com',
      '///evil.com',
      '/\\evil.com',
      '/\\/evil.com',
      '/\t/evil.com',
      '/\n/evil.com',
      '/\r/evil.com',
      '\t//evil.com',
      '/\u0000/evil.com',
    ]) {
      expect(safeNextPath(value), JSON.stringify(value)).toBe('/');
    }
  });

  it('kodlangan belgilar yo‘l ichida qoladi (boshqa saytga o‘tmaydi)', () => {
    expect(safeNextPath('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com');
    expect(safeNextPath('/%09/evil.com')).toBe('/%09/evil.com');
  });

  it('yo‘lni normallashtiradi', () => {
    expect(safeNextPath('/a/../account')).toBe('/account');
  });
});
