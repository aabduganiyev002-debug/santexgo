import { PRODUCT_UNITS } from '../product.js';
import { CATALOG_QUERY_KEYS, SLUG_REGEX } from './catalog.js';
import { optionalText, uuidSchema } from './common.js';
import { z } from './zod.js';

const slugInput = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .regex(SLUG_REGEX, {
    error: 'Faqat lotin kichik harflari, raqamlar va tire (masalan: ppr-truba)',
  })
  .optional()
  .or(z.literal('').transform(() => undefined));

/**
 * Diqqat: bu sxemalarda .default() ishlatilmaydi — tahrirlash (PATCH) sxemalari .partial() orqali
 * yasaladi va standart qiymat berilmagan maydonlarni ham o'zgartirib yuborardi.
 * Yaratishdagi standart qiymatlar servisda qo'llanadi.
 */
const sortOrder = z.coerce.number().int().min(-100_000).max(100_000).optional();
const som = z.coerce
  .number({ error: 'Summani kiriting' })
  .int({ error: 'Summa butun son bo‘lishi kerak' })
  .min(0, { error: 'Summa manfiy bo‘lmasligi kerak' })
  .max(1_000_000_000, { error: 'Summa juda katta' });

function requiredName(max: number) {
  return z
    .string({ error: 'Nomini kiriting' })
    .trim()
    .min(1, { error: 'Nomini kiriting' })
    .max(max, { error: `${max} belgidan oshmasligi kerak` });
}

const urlOrEmpty = z
  .union([z.url({ protocol: /^https?$/, error: 'To‘liq manzil: https://...' }), z.literal('')])
  .optional()
  .transform((value) => value || undefined);

// ─────────────────────────────── Brend ───────────────────────────────

export const brandInputSchema = z.object({
  name: requiredName(80),
  slug: slugInput,
  description: optionalText(5000),
  country: optionalText(60),
  website: urlOrEmpty,
  sortOrder,
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type BrandInput = z.input<typeof brandInputSchema>;
export const brandUpdateSchema = brandInputSchema.partial();

// ───────────────────────────── Kategoriya ─────────────────────────────

export const categoryInputSchema = z.object({
  name: requiredName(100),
  slug: slugInput,
  parentId: uuidSchema.nullable().optional(),
  description: optionalText(5000),
  sortOrder,
  isActive: z.boolean().optional(),
  /** Shu kategoriyada ishlatiladigan xususiyatlar (tartib bilan) */
  attributeIds: z.array(uuidSchema).max(50).optional(),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;
export const categoryUpdateSchema = categoryInputSchema.partial();

// ────────────────────────────── Material ──────────────────────────────

export const materialInputSchema = z.object({
  name: requiredName(40),
  slug: slugInput,
  fullName: optionalText(120),
  description: optionalText(5000),
  sortOrder,
  isActive: z.boolean().optional(),
});
export type MaterialInput = z.input<typeof materialInputSchema>;
export const materialUpdateSchema = materialInputSchema.partial();

// ───────────────────────────── Xususiyat ─────────────────────────────

const RESERVED_KEYS = new Set<string>(CATALOG_QUERY_KEYS);

export const attributeInputSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,39}$/, {
      error: 'Kalit: lotin kichik harflari, raqam va pastki chiziq (masalan: diameter_mm)',
    })
    .refine((key) => !RESERVED_KEYS.has(key), { error: 'Bu kalit band (katalog parametri)' }),
  name: requiredName(80),
  unit: optionalText(20),
  type: z.enum(['NUMBER', 'TEXT', 'BOOLEAN']).optional(),
  isFilterable: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  sortOrder,
});
export type AttributeInput = z.input<typeof attributeInputSchema>;
export const attributeUpdateSchema = attributeInputSchema.omit({ key: true, type: true }).partial();

// ────────────────────────────── Mahsulot ──────────────────────────────

export const attributeValueInputSchema = z.object({
  key: z.string().trim().min(1).max(40),
  /** null — qiymatni o'chirish */
  value: z.union([z.number().finite(), z.string().trim().max(120), z.boolean(), z.null()]),
});

export const productInputSchema = z.object({
  sku: z
    .string({ error: 'SKU kiriting' })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9._\-/]{1,63}$/, {
      error: 'SKU: lotin harflari, raqamlar, tire va nuqta (masalan: PLT-PPR-PN20-25)',
    }),
  name: requiredName(200),
  slug: slugInput,
  brandId: z.uuid({ error: 'Brendni tanlang' }),
  categoryId: z.uuid({ error: 'Kategoriyani tanlang' }),
  materialId: uuidSchema.nullable().optional(),
  groupId: uuidSchema.nullable().optional(),
  shortDescription: optionalText(300),
  description: optionalText(20_000),
  unit: z.enum(PRODUCT_UNITS).optional(),
  basePrice: som,
  minOrderQty: z.coerce.number().int().min(1).max(100_000).optional(),
  weightGrams: z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  warrantyMonths: z.coerce.number().int().min(0).max(600).nullable().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  metaTitle: optionalText(200),
  metaDescription: optionalText(320),
  attributes: z.array(attributeValueInputSchema).max(50).optional(),
  /** Faqat yaratishda: boshlang'ich qoldiq (asosiy omborga) */
  initialStock: z.coerce.number().int().min(0).max(10_000_000).optional(),
});
export type ProductInput = z.input<typeof productInputSchema>;
export const productUpdateSchema = productInputSchema.omit({ initialStock: true }).partial();
export type ProductUpdateInput = z.input<typeof productUpdateSchema>;

export const adminProductListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  brandId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  materialId: uuidSchema.optional(),
  status: z.enum(['active', 'archived', 'all']).default('all'),
  stock: z.enum(['in', 'low', 'out']).optional(),
  sort: z
    .enum(['new', 'name', 'price_asc', 'price_desc', 'stock_asc', 'stock_desc', 'sold'])
    .default('new'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const productGroupInputSchema = z.object({
  name: requiredName(200),
  variantAttributeKey: z.string().trim().max(40).nullable().optional(),
});
export const productGroupUpdateSchema = productGroupInputSchema.partial();

export const documentInputSchema = z.object({
  type: z.enum(['CERTIFICATE', 'PASSPORT', 'MANUAL', 'OTHER']).default('CERTIFICATE'),
  title: requiredName(200),
});

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const movementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const imageUpdateSchema = z.object({
  alt: optionalText(200),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
  isMain: z.boolean().optional(),
});

export const imageReorderSchema = z.object({
  imageIds: z.array(uuidSchema).min(1).max(50),
});

// ─────────────────────────────── Ombor ───────────────────────────────

export const inventoryAdjustSchema = z
  .object({
    /** Berilmasa — asosiy ombor */
    warehouseId: uuidSchema.optional(),
    /** add — kirim (+), remove — chiqim/hisobdan chiqarish (−), set — inventarizatsiya (aniq son) */
    operation: z.enum(['add', 'remove', 'set']),
    quantity: z.coerce
      .number({ error: 'Miqdorni kiriting' })
      .int({ error: 'Butun son kiriting' })
      .min(0, { error: 'Manfiy bo‘lmasligi kerak' })
      .max(10_000_000),
    note: optionalText(300),
  })
  .refine((data) => data.operation === 'set' || data.quantity > 0, {
    error: 'Miqdor 0 dan katta bo‘lishi kerak',
    path: ['quantity'],
  });
export type InventoryAdjustInput = z.input<typeof inventoryAdjustSchema>;

export const lowStockThresholdSchema = z.object({
  warehouseId: uuidSchema.optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000),
});
