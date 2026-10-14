import { describe, expect, it } from 'vitest';
import { uniqueSlug } from './unique-slug.js';

describe('uniqueSlug', () => {
  it('band bo‘lsa raqam qo‘shadi', async () => {
    const taken = new Set(['ppr-truba', 'ppr-truba-2']);
    expect(await uniqueSlug('PPR truba', async (s) => taken.has(s))).toBe('ppr-truba-3');
    expect(await uniqueSlug('PVC truba', async (s) => taken.has(s))).toBe('pvc-truba');
  });

  it('bo‘sh nomdan ham slug yasaydi', async () => {
    expect(await uniqueSlug('!!!', async () => false)).toBe('item');
  });
});
