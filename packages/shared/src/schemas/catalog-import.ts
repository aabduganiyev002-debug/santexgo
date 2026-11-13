import { PRODUCT_UNITS } from '../product.js';
import { skuSchema } from './catalog-admin.js';
import { SLUG_REGEX } from './catalog.js';
import { optionalText } from './common.js';
import { z } from './zod.js';

/**
 * Katalog importi: ZIP fayl — ildizida katalog.json, rasmlar images/ papkasida.
 * Admin panel faylni brauzerda ochadi va API'ga bo'laklab yuboradi: avval mahsulotlar
 * (CATALOG_IMPORT_BATCH_SIZE tadan), keyin har bir rasm bir marta — o'sha rasmli barcha SKU'lar bilan.
 */
export const CATALOG_IMPORT_FORMAT = 'santexgo-katalog';
export const CATALOG_IMPORT_FILE = 'katalog.json';
/** Bitta so'rovdagi mahsulotlar (JSON hajmi API chegarasidan — 100 KB — oshmasin) */
export const CATALOG_IMPORT_BATCH_SIZE = 100;
/** Bitta rasm biriktiriladigan SKU'lar soni */
export const CATALOG_IMPORT_MAX_SKUS_PER_IMAGE = 500;

function slug(max: number) {
  return z
    .string()
    .trim()
    .toLowerCase()
    .max(max)
    .regex(SLUG_REGEX, { error: 'Slug: lotin kichik harflari, raqamlar va tire' });
}

function text(max: number) {
  return z
    .string({ error: 'Matn kiriting' })
    .trim()
    .min(1, { error: 'Bo‘sh bo‘lmasligi kerak' })
    .max(max, { error: `${max} belgidan oshmasligi kerak` });
}

export const importCategorySchema = z.object({
  slug: slug(120),
  name: text(100),
  /** Ota kategoriya slug'i: bazada bo'lishi yoki shu ro'yxatda oldinroq kelishi kerak */
  parent: slug(120).nullable().optional(),
  sortOrder: z.number().int().min(-100_000).max(100_000).optional(),
  /** Katalog filtrida chiqadigan xususiyatlar kalitlari (diameter_mm, pn...) */
  attributes: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
});
export type ImportCategory = z.output<typeof importCategorySchema>;

export const importBrandSchema = z.object({
  slug: slug(100),
  name: text(80),
  country: optionalText(60),
});
export type ImportBrand = z.output<typeof importBrandSchema>;

export const importMaterialSchema = z.object({
  slug: slug(60),
  name: text(40),
  fullName: optionalText(120),
});
export type ImportMaterial = z.output<typeof importMaterialSchema>;

const attributeValue = z.union([
  z.number().finite(),
  z.string().trim().min(1).max(120),
  z.boolean(),
]);

export const importProductSchema = z.object({
  sku: skuSchema,
  name: text(200),
  category: slug(120),
  brand: slug(100),
  material: slug(60).optional(),
  /** Bir modelning o'lchamlari bitta guruhda: saytda o'lcham tanlash chiqadi */
  group: text(200).optional(),
  groupAttribute: z.string().trim().min(1).max(40).optional(),
  unit: z.enum(PRODUCT_UNITS).optional(),
  /** Sotuv narxi, so'm */
  price: z.number().int().min(1).max(1_000_000_000),
  /** Faqat yangi mahsulotga: boshlang'ich qoldiq (asosiy omborga) */
  stock: z.number().int().min(0).max(10_000_000).optional(),
  shortDescription: optionalText(300),
  description: optionalText(20_000),
  attributes: z.record(z.string().trim().min(1).max(40), attributeValue).optional(),
  /** ZIP ichidagi rasm fayllari (images/...) */
  images: z.array(text(200)).max(10).optional(),
});
export type ImportProduct = z.output<typeof importProductSchema>;

/** katalog.json — butun fayl (admin panel tekshiradi) */
export const catalogImportFileSchema = z
  .object({
    format: z.literal(CATALOG_IMPORT_FORMAT, { error: 'Bu SantexGo katalog fayli emas' }),
    version: z.literal(1, { error: 'Katalog faylining bu versiyasi qo‘llab-quvvatlanmaydi' }),
    title: optionalText(200),
    categories: z.array(importCategorySchema).max(1000).default([]),
    brands: z.array(importBrandSchema).max(1000).default([]),
    materials: z.array(importMaterialSchema).max(200).default([]),
    products: z.array(importProductSchema).min(1, { error: 'Faylda mahsulot yo‘q' }).max(50_000),
  })
  .superRefine((file, ctx) => {
    const seen = new Map<string, number>();
    file.products.forEach((product, index) => {
      const previous = seen.get(product.sku);
      if (previous !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['products', index, 'sku'],
          message: `SKU takrorlangan: ${product.sku} (${previous + 1}- va ${index + 1}-mahsulot)`,
        });
      }
      seen.set(product.sku, index);
    });
  });
export type CatalogImportFile = z.output<typeof catalogImportFileSchema>;

/** POST /admin/catalog-import/products — bitta bo'lak */
export const catalogImportBatchSchema = z.object({
  categories: z.array(importCategorySchema).max(1000).optional(),
  brands: z.array(importBrandSchema).max(1000).optional(),
  materials: z.array(importMaterialSchema).max(200).optional(),
  products: z.array(importProductSchema).max(CATALOG_IMPORT_BATCH_SIZE),
});
export type CatalogImportBatchInput = z.input<typeof catalogImportBatchSchema>;

/** POST /admin/catalog-import/image — multipart: file + skus (vergul bilan) */
export const catalogImportImageSchema = z.object({
  skus: z
    .string({ error: 'SKU ro‘yxati kerak' })
    .transform((value) =>
      value
        .split(',')
        .map((sku) => sku.trim())
        .filter(Boolean),
    )
    .pipe(z.array(skuSchema).min(1).max(CATALOG_IMPORT_MAX_SKUS_PER_IMAGE)),
});
