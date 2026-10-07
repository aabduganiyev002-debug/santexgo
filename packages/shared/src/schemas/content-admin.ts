import { normalizeUzPhone } from '../phone.js';
import { optionalText, uuidSchema } from './common.js';
import { z } from './zod.js';

/** Sayt ichidagi yo'l (/catalog/...) yoki to'liq https manzil. */
const linkUrl = z
  .union([
    z
      .string()
      .trim()
      .regex(/^\/[^\s]*$/, {
        error: 'Manzil "/" bilan boshlanishi kerak (masalan: /brands/plastherm)',
      })
      .max(500),
    z.url({ protocol: /^https?$/ }).max(500),
    z.literal(''),
  ])
  .optional()
  .transform((value) => value || undefined);

const sortOrder = z.coerce.number().int().min(-100_000).max(100_000).optional();
/** multipart formada bo'sh maydon ('') — sana olib tashlanadi (null) */
const dateOrNull = z
  .preprocess(
    (value) => (value === '' ? null : value),
    z.coerce.date({ error: 'Sanani to‘g‘ri kiriting' }).nullable(),
  )
  .optional();

// ─────────────────────────────── Bannerlar ───────────────────────────────

const bannerFields = z.object({
  title: optionalText(120),
  subtitle: optionalText(200),
  linkUrl,
  sortOrder,
  isActive: z.coerce.boolean().optional(),
  startsAt: dateOrNull,
  endsAt: dateOrNull,
});

/** multipart forma maydonlari matn bo'lib keladi: "true"/"false" → boolean */
const formBoolean = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1')
  .optional();

export const bannerInputSchema = bannerFields
  .extend({ isActive: formBoolean })
  .refine((data) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt, {
    error: 'Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak',
    path: ['endsAt'],
  });
export const bannerUpdateSchema = bannerInputSchema;

// ───────────────────────── "Material bo'yicha" tugmalari ─────────────────────────

export const homeCollectionInputSchema = z.object({
  title: z.string({ error: 'Nomini kiriting' }).trim().min(1, { error: 'Nomini kiriting' }).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80)
    .optional(),
  materialId: uuidSchema.nullable().optional(),
  categoryId: uuidSchema.nullable().optional(),
  brandId: uuidSchema.nullable().optional(),
  sortOrder,
  isActive: z.boolean().optional(),
});
export const homeCollectionUpdateSchema = homeCollectionInputSchema.partial();

// ─────────────────────────────── Sozlamalar ───────────────────────────────

const optionalPhone = z
  .string()
  .trim()
  .max(32)
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const phone = normalizeUzPhone(value);
    if (!phone) {
      ctx.addIssue({ code: 'custom', message: 'Telefon raqami noto‘g‘ri' });
      return z.NEVER;
    }
    return phone;
  });

export const storeSettingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: optionalPhone,
  /** Qo'shimcha raqam (masalan, ulgurji savdo bo'limi) */
  phone2: optionalPhone,
  email: z
    .union([z.email(), z.literal('')])
    .optional()
    .transform((value) => value || undefined),
  address: optionalText(300),
  workingHours: optionalText(120),
  telegram: optionalText(100),
  instagram: optionalText(100),
});
export interface StoreSettings {
  name: string;
  phone?: string;
  phone2?: string;
  email?: string;
  address?: string;
  workingHours?: string;
  telegram?: string;
  instagram?: string;
}

const som = z.coerce.number().int().min(0).max(100_000_000);

export const deliverySettingsSchema = z.object({
  /** Yetkazib berish narxi (so'm) */
  baseFee: som,
  /** Shu summadan boshlab bepul (null — bepul yetkazib berish yo'q) */
  freeFrom: som.nullable(),
  pickupEnabled: z.boolean(),
  pickupAddress: optionalText(300),
  /** Mijozga ko'rsatiladigan izoh: "Toshkent bo'ylab 1–2 kunda" */
  note: optionalText(300),
});
export interface DeliverySettings {
  baseFee: number;
  freeFrom: number | null;
  pickupEnabled: boolean;
  pickupAddress?: string;
  note?: string;
}

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  baseFee: 30_000,
  freeFrom: 1_000_000,
  pickupEnabled: true,
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = { name: 'SantexGo' };

/** Yetkazib berish narxi: bepul chegaradan oshsa yoki o'zi olib ketsa — 0. */
export function deliveryFee(
  settings: DeliverySettings,
  itemsTotal: number,
  method: 'DELIVERY' | 'PICKUP',
): number {
  if (method === 'PICKUP') return 0;
  if (settings.freeFrom !== null && itemsTotal >= settings.freeFrom) return 0;
  return settings.baseFee;
}
