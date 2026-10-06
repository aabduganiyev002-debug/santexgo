import { describe, expect, it } from 'vitest';
import { slugify } from './slug.js';

describe('slugify', () => {
  it('mahsulot nomlaridan toza slug yasaydi', () => {
    expect(slugify('Plastherm PPR truba Ø25 PN20 4 m')).toBe('plastherm-ppr-truba-d25-pn20-4-m');
    expect(slugify('Sharli kran 1/2"')).toBe('sharli-kran-1-2');
    expect(slugify('Tirsak 90°')).toBe('tirsak-90');
  });

  it("o'zbek harflari va apostroflarni to'g'ri ishlaydi", () => {
    expect(slugify("Do'kon O‘zbekiston g'isht")).toBe('dokon-ozbekiston-gisht');
  });

  it('kirill yozuvini lotinga o‘giradi', () => {
    expect(slugify('Труба ППР Ø20')).toBe('truba-ppr-d20');
    expect(slugify('Ўзбекистон қувур')).toBe('ozbekiston-quvur');
  });

  it('uzunlikni cheklaydi va chetdagi tirelarni olib tashlaydi', () => {
    expect(slugify('  --Salom--  ')).toBe('salom');
    expect(slugify('a b c d e', 4)).toBe('a-b');
  });
});
