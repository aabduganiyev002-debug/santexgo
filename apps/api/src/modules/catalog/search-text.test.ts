import { describe, expect, it } from 'vitest';
import { buildSearchText } from './search-text.js';

describe('buildSearchText', () => {
  it('nom, SKU, brend, kategoriya, material va o‘lchamlarni birlashtiradi', () => {
    const text = buildSearchText({
      name: 'Plastherm PPR truba Ø25 PN20, 4 m',
      sku: 'PLT-PPR-PN20-25',
      brand: 'Plastherm',
      categories: ['Trubalar'],
      material: { name: 'PPR', fullName: 'Polipropilen random sopolimer (PP-R)' },
      attributes: [
        { unit: 'mm', value: '25' },
        { unit: null, value: 'PN20' },
      ],
    });
    const words = text.split(' ');
    for (const word of [
      'plastherm',
      'ppr',
      'truba',
      'd25',
      'pn20',
      '25',
      '25mm',
      'trubalar',
      'plt',
      'pltpprpn2025',
    ]) {
      expect(words).toContain(word);
    }
    // Takrorlanmaydi
    expect(words.filter((w) => w === 'plastherm')).toHaveLength(1);
  });
});
