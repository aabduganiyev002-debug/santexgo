import { PRODUCT_SORTS } from '../api/catalog.js';
import { z } from './zod.js';

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Katalog URL'idagi standart parametrlar. Xususiyat kalitlari ular bilan bir xil bo'lishi mumkin emas. */
export const CATALOG_QUERY_KEYS = [
  'q',
  'brand',
  'material',
  'category',
  'priceMin',
  'priceMax',
  'inStock',
  'onSale',
  'sort',
  'page',
  'pageSize',
] as const;

export const MAX_PAGE_SIZE = 60;
export const DEFAULT_PAGE_SIZE = 24;

/** "a,b" yoki ["a","b"] → ["a","b"] (takrorlarsiz) */
export function csvList(maxItems = 30, maxLength = 100) {
  return z.union([z.string(), z.array(z.string())]).transform((value) => {
    const parts = (Array.isArray(value) ? value : [value])
      .flatMap((item) => item.split(','))
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.length <= maxLength);
    return [...new Set(parts)].slice(0, maxItems);
  });
}

const queryBool = z
  .union([z.string(), z.boolean()])
  .transform((value) => value === true || value === '1' || value === 'true');

const slugList = csvList().transform((items) => items.filter((item) => SLUG_REGEX.test(item)));

const optionalSom = z.coerce.number().int().min(0).max(1_000_000_000).optional();

/**
 * Katalog filtrlari (URL query). Standart parametrlardan tashqari kalitlar —
 * xususiyat filtrlari: ?diameter_mm=25,32&pn=PN20
 */
export const productListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    brand: slugList.optional(),
    material: slugList.optional(),
    category: z.string().regex(SLUG_REGEX).max(120).optional(),
    priceMin: optionalSom,
    priceMax: optionalSom,
    inStock: queryBool.optional(),
    onSale: queryBool.optional(),
    sort: z.enum(PRODUCT_SORTS).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .catchall(csvList(30, 60));
export type ProductListQuery = z.output<typeof productListQuerySchema>;

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});
