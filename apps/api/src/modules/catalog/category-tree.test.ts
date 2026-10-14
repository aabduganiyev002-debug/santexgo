import { describe, expect, it } from 'vitest';
import { CategoryTree, type CategoryRecord } from './category-tree.js';

function cat(id: string, parentId: string | null, sortOrder = 0, isActive = true): CategoryRecord {
  return {
    id,
    parentId,
    slug: id,
    name: id,
    description: null,
    imageUrl: null,
    sortOrder,
    isActive,
  };
}

const tree = new CategoryTree([
  cat('fittinglar', null, 20),
  cat('trubalar', null, 10),
  cat('tirsaklar', 'fittinglar', 10),
  cat('muftalar', 'fittinglar', 20),
  cat('tirsak-90', 'tirsaklar'),
  cat('arxiv', 'fittinglar', 30, false),
]);

describe('CategoryTree', () => {
  it('ildiz va ichki kategoriyalarni tartib bilan beradi', () => {
    expect(tree.roots().map((c) => c.id)).toEqual(['trubalar', 'fittinglar']);
    expect(tree.children('fittinglar').map((c) => c.id)).toEqual(['tirsaklar', 'muftalar']);
    expect(tree.children('fittinglar', false).map((c) => c.id)).toContain('arxiv');
  });

  it('barcha ichki kategoriyalarni (faollarini) topadi', () => {
    expect(tree.descendantIds('fittinglar').sort()).toEqual(
      ['fittinglar', 'muftalar', 'tirsak-90', 'tirsaklar'].sort(),
    );
  });

  it('yo‘l va ko‘rinish', () => {
    expect(tree.path('tirsak-90').map((c) => c.id)).toEqual([
      'fittinglar',
      'tirsaklar',
      'tirsak-90',
    ]);
    expect(tree.isVisible('tirsak-90')).toBe(true);
    expect(tree.isVisible('arxiv')).toBe(false);
    expect(tree.isAncestorOrSelf('fittinglar', 'tirsak-90')).toBe(true);
    expect(tree.isAncestorOrSelf('trubalar', 'tirsak-90')).toBe(false);
  });

  it('mahsulotlar sonini ota-kategoriyalarga yig‘adi', () => {
    const totals = tree.rollUp(
      new Map([
        ['tirsak-90', 2],
        ['muftalar', 3],
        ['trubalar', 5],
      ]),
    );
    expect(totals.get('fittinglar')).toBe(5);
    expect(totals.get('tirsaklar')).toBe(2);
    expect(totals.get('trubalar')).toBe(5);
  });
});
