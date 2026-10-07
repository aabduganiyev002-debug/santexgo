import { describe, expect, it } from 'vitest';
import { normalizeSearchText, searchTokens, tokenVariants } from './search.js';

describe('normalizeSearchText', () => {
  it('lotin va kirill yozuvini bir xil ko‘rinishga keltiradi', () => {
    expect(normalizeSearchText('Plastherm PPR truba Ø25 PN20, 4 m')).toBe(
      'plastherm ppr truba d25 pn20 4 m',
    );
    expect(normalizeSearchText('Труба ППР Ø25')).toBe('truba ppr d25');
    expect(normalizeSearchText('O‘zbekiston')).toBe('ozbekiston');
  });

  it('rezba o‘lchami va kasr sonlarni saqlaydi', () => {
    expect(normalizeSearchText('Sharli kran 1/2"')).toBe('sharli kran 1/2');
    expect(normalizeSearchText('Devor 3,4 mm')).toBe('devor 3.4 mm');
    expect(normalizeSearchText('PLT-PPR-PN20-25')).toBe('plt ppr pn20 25');
  });
});

describe('searchTokens', () => {
  it('so‘rovni so‘zlarga ajratadi va takrorlarni olib tashlaydi', () => {
    expect(searchTokens('  Plastherm 25 PN20 plastherm ')).toEqual(['plastherm', '25', 'pn20']);
    expect(searchTokens('...')).toEqual([]);
  });
});

describe('tokenVariants', () => {
  it('sinonimlarni qo‘shadi', () => {
    expect(tokenVariants(searchTokens('ПВХ')[0]!)).toEqual(['pvx', 'pvc']);
    expect(tokenVariants('quvur')).toEqual(['quvur', 'truba']);
    expect(tokenVariants('plastherm')).toEqual(['plastherm']);
  });
});
