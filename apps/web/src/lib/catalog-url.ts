import { CATALOG_QUERY_KEYS, type ProductSort } from '@santexgo/shared';

/** Katalog filtrlari URL'da: /catalog/trubalar?brand=plastherm&material=ppr&diameter_mm=25&page=2 */
export type CatalogParams = Record<string, string | undefined>;

const RESERVED = new Set<string>(CATALOG_QUERY_KEYS);

/** Next.js searchParams → oddiy obyekt (bir nechta qiymat vergul bilan). */
export function normalizeSearchParams(
  params: Record<string, string | string[] | undefined>,
): CatalogParams {
  const result: CatalogParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const joined = Array.isArray(value) ? value.join(',') : value;
    if (joined.trim() !== '') result[key] = joined;
  }
  return result;
}

export function toQueryString(params: CatalogParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function listValues(params: CatalogParams, key: string): string[] {
  return (params[key] ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Qiymatni qo'shadi yoki olib tashlaydi (checkbox). Sahifa 1 ga qaytadi. */
export function toggleValue(params: CatalogParams, key: string, value: string): CatalogParams {
  const values = listValues(params, key);
  const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  return { ...params, [key]: next.length > 0 ? next.join(',') : undefined, page: undefined };
}

export function setParam(
  params: CatalogParams,
  key: string,
  value: string | undefined,
): CatalogParams {
  return { ...params, [key]: value, ...(key === 'page' ? {} : { page: undefined }) };
}

/** Xususiyat filtrlari (standart parametrlardan tashqari kalitlar). */
export function attributeParams(params: CatalogParams): [string, string[]][] {
  return Object.keys(params)
    .filter((key) => !RESERVED.has(key))
    .map((key) => [key, listValues(params, key)] as [string, string[]])
    .filter(([, values]) => values.length > 0);
}

export function hasActiveFilters(params: CatalogParams): boolean {
  return Object.keys(params).some((key) => !['sort', 'page', 'pageSize', 'q'].includes(key));
}

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'popular', label: 'Ommabop' },
  { value: 'new', label: 'Yangilari' },
  { value: 'price_asc', label: 'Arzonroq' },
  { value: 'price_desc', label: 'Qimmatroq' },
  { value: 'discount', label: 'Chegirma bo‘yicha' },
];

/** "Material bo'yicha" tugmasidan katalog havolasi. */
export function collectionHref(filter: {
  category: string | null;
  material: string | null;
  brand: string | null;
}): string {
  const base = filter.category ? `/catalog/${filter.category}` : '/catalog';
  return `${base}${toQueryString({ material: filter.material ?? undefined, brand: filter.brand ?? undefined })}`;
}
