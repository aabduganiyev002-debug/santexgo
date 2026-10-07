import { DISCOUNT_TYPES } from '../discount.js';
import { uuidSchema } from './common.js';
import { z } from './zod.js';

const MAX_TARGETS = 1000;

const ids = z.array(uuidSchema).max(MAX_TARGETS).optional();

const targetsSchema = z.object({
  productIds: ids,
  categoryIds: ids,
  brandIds: ids,
});

const dateInput = z.coerce.date({ error: 'Sanani to‘g‘ri kiriting' });

const discountFields = {
  name: z
    .string({ error: 'Nomini kiriting' })
    .trim()
    .min(1, { error: 'Nomini kiriting' })
    .max(120, { error: '120 belgidan oshmasligi kerak' }),
  type: z.enum(DISCOUNT_TYPES),
  /** PERCENT: 1–100; FIXED: so'm */
  value: z.coerce
    .number({ error: 'Qiymatni kiriting' })
    .int({ error: 'Butun son kiriting' })
    .min(1, { error: 'Qiymat 0 dan katta bo‘lishi kerak' })
    .max(1_000_000_000),
  startsAt: dateInput.optional(),
  /** null — muddatsiz */
  endsAt: dateInput.nullable().optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
  targets: targetsSchema.optional(),
};

function countTargets(targets: z.output<typeof targetsSchema> | undefined): number {
  return (
    (targets?.productIds?.length ?? 0) +
    (targets?.categoryIds?.length ?? 0) +
    (targets?.brandIds?.length ?? 0)
  );
}

function checkRules(
  data: {
    type?: (typeof DISCOUNT_TYPES)[number];
    value?: number;
    startsAt?: Date;
    endsAt?: Date | null;
  },
  ctx: z.RefinementCtx,
): void {
  if (data.type === 'PERCENT' && data.value !== undefined && data.value > 100) {
    ctx.addIssue({ code: 'custom', path: ['value'], message: 'Foiz 100 dan oshmasligi kerak' });
  }
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['endsAt'],
      message: 'Tugash sanasi boshlanish sanasidan keyin bo‘lishi kerak',
    });
  }
}

/** Yangi chegirma: kamida bitta mahsulot, kategoriya yoki brendga tegishli bo'lishi kerak. */
export const discountInputSchema = z
  .object({ ...discountFields, type: discountFields.type, value: discountFields.value })
  .superRefine((data, ctx) => {
    checkRules(data, ctx);
    if (countTargets(data.targets) === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['targets'],
        message: 'Chegirma qaysi mahsulot, kategoriya yoki brendga tegishli ekanini tanlang',
      });
    }
  });
export type DiscountInput = z.input<typeof discountInputSchema>;

/** Tahrirlash: faqat berilgan maydonlar o'zgaradi; targets berilsa — to'liq almashtiriladi. */
export const discountUpdateSchema = z
  .object({
    name: discountFields.name.optional(),
    type: discountFields.type.optional(),
    value: discountFields.value.optional(),
    startsAt: discountFields.startsAt,
    endsAt: discountFields.endsAt,
    priority: discountFields.priority,
    isActive: discountFields.isActive,
    targets: discountFields.targets,
  })
  .superRefine((data, ctx) => {
    checkRules(data, ctx);
    if (data.targets && countTargets(data.targets) === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['targets'],
        message: 'Kamida bitta mahsulot, kategoriya yoki brend tanlang',
      });
    }
  });
export type DiscountUpdateInput = z.input<typeof discountUpdateSchema>;

export const DISCOUNT_STATUSES = ['active', 'scheduled', 'expired', 'disabled'] as const;
export type DiscountStatus = (typeof DISCOUNT_STATUSES)[number];

export const DISCOUNT_STATUS_LABELS: Record<DiscountStatus, string> = {
  active: 'Amalda',
  scheduled: 'Rejalashtirilgan',
  expired: 'Muddati tugagan',
  disabled: 'O‘chirilgan',
};

export const discountListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum([...DISCOUNT_STATUSES, 'all']).default('all'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

/** Chegirma holati (ro'yxatda ko'rsatish uchun). */
export function discountStatus(
  discount: { isActive: boolean; startsAt: Date; endsAt: Date | null },
  now: Date = new Date(),
): DiscountStatus {
  if (!discount.isActive) return 'disabled';
  if (discount.startsAt.getTime() > now.getTime()) return 'scheduled';
  if (discount.endsAt && discount.endsAt.getTime() <= now.getTime()) return 'expired';
  return 'active';
}
