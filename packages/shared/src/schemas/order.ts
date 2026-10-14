import { DELIVERY_METHODS, ORDER_STATUSES, PAYMENT_METHODS } from '../order.js';
import { optionalText, personNameSchema, phoneSchema, uuidSchema } from './common.js';
import { z } from './zod.js';

/** O'zbekiston viloyatlari (manzil formasi uchun). */
export const UZ_REGIONS = [
  'Toshkent shahri',
  'Toshkent viloyati',
  'Andijon viloyati',
  'Buxoro viloyati',
  'Farg‘ona viloyati',
  'Jizzax viloyati',
  'Xorazm viloyati',
  'Namangan viloyati',
  'Navoiy viloyati',
  'Qashqadaryo viloyati',
  'Qoraqalpog‘iston Respublikasi',
  'Samarqand viloyati',
  'Sirdaryo viloyati',
  'Surxondaryo viloyati',
] as const;

export const MAX_ORDER_QUANTITY = 100_000;
export const MAX_CART_LINES = 200;

const quantity = z.coerce
  .number({ error: 'Miqdorni kiriting' })
  .int({ error: 'Butun son kiriting' })
  .min(1, { error: 'Kamida 1' })
  .max(MAX_ORDER_QUANTITY, { error: 'Juda katta miqdor' });

export const cartQuantitySchema = z.object({ quantity });

const cartLines = z.array(z.object({ productId: uuidSchema, quantity })).max(MAX_CART_LINES, {
  error: `Savatchada ${MAX_CART_LINES} tadan ortiq mahsulot bo‘lmasligi kerak`,
});

export const cartItemsSchema = z.object({ items: cartLines });
export type CartItemsInput = z.input<typeof cartItemsSchema>;

/** Savatchani hisoblash (mehmon uchun ham): narx, qoldiq, yetkazib berish narxi. */
export const cartPreviewSchema = z.object({
  items: cartLines,
  deliveryMethod: z.enum(DELIVERY_METHODS).optional(),
});
export type CartPreviewInput = z.input<typeof cartPreviewSchema>;

export const cartViewQuerySchema = z.object({
  deliveryMethod: z.enum(DELIVERY_METHODS).optional(),
});

function requiredText(label: string, max: number) {
  return z
    .string({ error: `${label}ni kiriting` })
    .trim()
    .min(1, { error: `${label}ni kiriting` })
    .max(max, { error: `${max} belgidan oshmasligi kerak` });
}

export const addressInputSchema = z.object({
  label: optionalText(40),
  region: requiredText('Viloyat', 80),
  district: requiredText('Tuman/shahar', 80),
  street: requiredText('Ko‘cha', 160),
  house: optionalText(20),
  apartment: optionalText(20),
  landmark: optionalText(160),
});
export type AddressInput = z.input<typeof addressInputSchema>;

export const MAX_ADDRESSES = 10;

/** Shaxsiy kabinetdagi saqlangan manzil */
export const addressSaveSchema = addressInputSchema.extend({
  isDefault: z.boolean().optional(),
});
export type AddressSaveInput = z.input<typeof addressSaveSchema>;

/** Hozircha mijoz tanlay oladigan to'lov turlari (onlayn to'lovlar keyingi bosqichda ulanadi). */
export const CHECKOUT_PAYMENT_METHODS = ['CASH', 'CARD_ON_DELIVERY'] as const;

/** Checkout formasidagi maydonlar (mijoz to'ldiradi). */
const checkoutFields = z.object({
  firstName: personNameSchema('Ism'),
  lastName: personNameSchema('Familiya'),
  phone: phoneSchema,
  deliveryMethod: z.enum(DELIVERY_METHODS, { error: 'Yetkazib berish usulini tanlang' }),
  /** Saqlangan manzil (bo'lsa) */
  addressId: uuidSchema.optional(),
  /** Yangi manzil */
  address: addressInputSchema.optional(),
  saveAddress: z.boolean().optional(),
  comment: optionalText(500),
  paymentMethod: z.enum(PAYMENT_METHODS, { error: 'To‘lov turini tanlang' }),
});

function requireAddress(
  data: { deliveryMethod: string; addressId?: string; address?: object },
  ctx: z.RefinementCtx,
): void {
  if (data.deliveryMethod === 'DELIVERY' && !data.addressId && !data.address) {
    ctx.addIssue({
      code: 'custom',
      path: ['address'],
      message: 'Yetkazib berish manzilini kiriting',
    });
  }
}

export const checkoutFormSchema = checkoutFields.superRefine(requireAddress);
export type CheckoutFormInput = z.input<typeof checkoutFormSchema>;

export const checkoutSchema = checkoutFields
  .extend({
    /** Buyurtma qilinadigan mahsulotlar — mijoz ekranda ko'rgan savatcha */
    items: cartLines.min(1, { error: 'Savatcha bo‘sh' }),
    /** Mijoz ekranda ko'rgan jami summa — narx o'zgargan bo'lsa ogohlantiriladi */
    expectedTotal: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    /** Har bir "Buyurtma berish" urinishi uchun yagona kalit (ikki marta bosilsa ham bitta buyurtma) */
    idempotencyKey: z.uuid(),
  })
  .superRefine(requireAddress);
export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

export const cancelOrderSchema = z.object({
  reason: optionalText(300),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: optionalText(300),
});

export const adminOrderListQuerySchema = z.object({
  /** Buyurtma raqami (ORDER-10254 yoki 10254), telefon yoki mijoz ismi */
  q: z.string().trim().max(100).optional(),
  status: z.enum([...ORDER_STATUSES, 'active', 'all']).default('all'),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  userId: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const adminOrderUpdateSchema = z
  .object({
    /** Ichki izoh (mijozga ko'rinmaydi); bo'sh satr — o'chirish */
    adminNote: z.string().trim().max(1000).nullable().optional(),
    /** To'lov holati qo'lda (masalan, karta orqali to'lov qabul qilindi) */
    paymentStatus: z.enum(['PENDING', 'PAID', 'REFUNDED']).optional(),
  })
  .refine((data) => data.adminNote !== undefined || data.paymentStatus !== undefined, {
    error: 'O‘zgartirish uchun maydon berilmagan',
  });

export const myOrdersQuerySchema = z.object({
  status: z.enum(['active', 'completed', 'all']).default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const MAX_FAVORITES = 500;

export const favoritesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});
