import { type ProductSort, tokenVariants } from '@santexgo/shared';
import { Prisma } from '../../generated/prisma/client.js';
import type { AttributeRecord } from './catalog-cache.service.js';

export interface AttributeFilter {
  attribute: AttributeRecord;
  numbers: number[];
  texts: string[];
  booleans: boolean[];
}

/** URL'dan o'qilgan va bazadagi ID'larga bog'langan filtrlar. */
export interface ResolvedFilters {
  brandSlugs: string[];
  materialSlugs: string[];
  /** Tanlangan kategoriya */
  categoryId: string | null;
  /** Tanlangan kategoriya va uning barcha ichki kategoriyalari */
  categoryIds: string[] | null;
  attributes: AttributeFilter[];
  priceMin?: number;
  priceMax?: number;
  inStock: boolean;
  onSale: boolean;
  /** Qidiruv so'zlari (normallashtirilgan) */
  tokens: string[];
  /** Xato yozilgan so'zlarni ham qidirish (aniq natija bo'lmaganda) */
  fuzzy: boolean;
}

/** Filtr guruhi: "facet" sonlarini hisoblashda shu guruhning o'z filtri hisobga olinmaydi. */
export type FacetGroup = 'brand' | 'material' | 'category' | 'price' | 'flags' | `attr:${string}`;

export const PRODUCT_FROM = Prisma.sql`
  products p
  JOIN brands b ON b.id = p.brand_id
  JOIN categories c ON c.id = p.category_id
  LEFT JOIN materials m ON m.id = p.material_id`;

/** So'z o'xshashligi chegarasi (0–1): "plasterm"/"plastherm" ≈ 0.58, "kanalizasiya"/"kanalizatsiya" ≈ 0.69 */
const FUZZY_THRESHOLD = 0.5;

/** LIKE uchun maxsus belgilarni ekranlaydi (% va _ oddiy belgi sifatida qidiriladi). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function attributeCondition(filter: AttributeFilter): Prisma.Sql | null {
  const id = filter.attribute.id;
  switch (filter.attribute.type) {
    case 'NUMBER':
      if (filter.numbers.length === 0) return null;
      return Prisma.sql`EXISTS (SELECT 1 FROM product_attribute_values v
        WHERE v.product_id = p.id AND v.attribute_id = ${id}::uuid
          AND v.number_value = ANY(${filter.numbers}::float8[]))`;
    case 'TEXT':
      if (filter.texts.length === 0) return null;
      return Prisma.sql`EXISTS (SELECT 1 FROM product_attribute_values v
        WHERE v.product_id = p.id AND v.attribute_id = ${id}::uuid
          AND lower(v.text_value) = ANY(${filter.texts.map((t) => t.toLowerCase())}::text[]))`;
    case 'BOOLEAN':
      if (filter.booleans.length === 0) return null;
      return Prisma.sql`EXISTS (SELECT 1 FROM product_attribute_values v
        WHERE v.product_id = p.id AND v.attribute_id = ${id}::uuid
          AND v.boolean_value = ANY(${filter.booleans}::boolean[]))`;
  }
}

const NUMERIC_TOKEN = /^\d+(?:[./]\d+)?$/;

/** Regex uchun maxsus belgilarni ekranlaydi. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, (ch) => `\\${ch}`);
}

function tokenCondition(token: string, fuzzy: boolean): Prisma.Sql {
  // Raqam alohida so'z sifatida: "25" → "25", "d25", "25mm" (lekin "pn25", "250" emas)
  if (NUMERIC_TOKEN.test(token)) {
    return Prisma.sql`p.search_text ~ ${`(^| )d?${escapeRegex(token)}(mm|m)?( |$)`}`;
  }
  const variants = tokenVariants(token).map(
    (variant) => Prisma.sql`p.search_text LIKE ${`%${escapeLike(variant)}%`}`,
  );
  // Xatoli yozuv: "plasterm" → "plastherm" (pg_trgm so'z o'xshashligi). Qisqa so'zlar — faqat aniq.
  // Faqat aniq natija topilmaganda ishlatiladi, shuning uchun indekssiz hisoblash yetarli.
  if (fuzzy && token.length >= 4) {
    variants.push(Prisma.sql`word_similarity(${token}, p.search_text) >= ${FUZZY_THRESHOLD}`);
  }
  return variants.length === 1 ? variants[0]! : Prisma.sql`(${Prisma.join(variants, ' OR ')})`;
}

/** WHERE sharti. `exclude` — facet hisoblanayotgan guruhning o'z filtri qo'llanmaydi. */
export function buildWhere(filters: ResolvedFilters, exclude?: FacetGroup): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`p.is_active`,
    Prisma.sql`b.is_active`,
    Prisma.sql`c.is_active`,
  ];

  if (filters.brandSlugs.length > 0 && exclude !== 'brand') {
    conditions.push(Prisma.sql`b.slug = ANY(${filters.brandSlugs}::text[])`);
  }
  if (filters.materialSlugs.length > 0 && exclude !== 'material') {
    conditions.push(Prisma.sql`m.slug = ANY(${filters.materialSlugs}::text[])`);
  }
  if (filters.categoryIds && exclude !== 'category') {
    conditions.push(Prisma.sql`p.category_id = ANY(${filters.categoryIds}::uuid[])`);
  }
  for (const filter of filters.attributes) {
    if (exclude === `attr:${filter.attribute.id}`) continue;
    const condition = attributeCondition(filter);
    if (condition) conditions.push(condition);
  }
  if (exclude !== 'price') {
    if (filters.priceMin !== undefined) {
      conditions.push(Prisma.sql`p.current_price >= ${filters.priceMin}`);
    }
    if (filters.priceMax !== undefined) {
      conditions.push(Prisma.sql`p.current_price <= ${filters.priceMax}`);
    }
  }
  if (exclude !== 'flags') {
    if (filters.inStock) conditions.push(Prisma.sql`p.available_stock > 0`);
    if (filters.onSale) conditions.push(Prisma.sql`p.current_price < p.base_price`);
  }
  for (const token of filters.tokens) {
    conditions.push(tokenCondition(token, filters.fuzzy));
  }
  return Prisma.join(conditions, ' AND ');
}

/** Saralash. Sotuvda bor mahsulotlar har doim birinchi, oxirida — barqaror tartib uchun ID. */
export function buildOrderBy(sort: ProductSort, filters: ResolvedFilters): Prisma.Sql {
  let order: Prisma.Sql;
  switch (sort) {
    case 'new':
      order = Prisma.sql`p.created_at DESC`;
      break;
    case 'price_asc':
      order = Prisma.sql`p.current_price ASC`;
      break;
    case 'price_desc':
      order = Prisma.sql`p.current_price DESC`;
      break;
    case 'discount':
      order = Prisma.sql`(p.base_price - p.current_price)::float8 / NULLIF(p.base_price, 0) DESC NULLS LAST, p.sold_count DESC`;
      break;
    case 'relevance':
      order =
        filters.tokens.length > 0
          ? Prisma.sql`word_similarity(${filters.tokens.join(' ')}, p.search_text) DESC, p.sold_count DESC`
          : Prisma.sql`p.sold_count DESC, p.created_at DESC`;
      break;
    case 'popular':
    default:
      order = Prisma.sql`p.sold_count DESC, p.created_at DESC`;
  }
  return Prisma.sql`(p.available_stock > 0) DESC, ${order}, p.id`;
}
