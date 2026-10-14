import { describe, expect, it } from 'vitest';
import { diffChanges } from './audit.service.js';

describe('diffChanges', () => {
  it('faqat o‘zgargan maydonlarni qaytaradi', () => {
    expect(
      diffChanges(
        { name: 'A', basePrice: 100, updatedAt: new Date(1), tags: ['x'] },
        { name: 'A', basePrice: 90, updatedAt: new Date(2), tags: ['x', 'y'] },
      ),
    ).toEqual({ basePrice: { from: 100, to: 90 }, tags: { from: ['x'], to: ['x', 'y'] } });
  });

  it('maxfiy maydonlarni yozmaydi', () => {
    expect(diffChanges({ passwordHash: 'a' }, { passwordHash: 'b' })).toEqual({});
  });
});
