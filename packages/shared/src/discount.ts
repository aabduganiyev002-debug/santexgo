import { assertSom } from './money.js';

export const DISCOUNT_TYPES = ['PERCENT', 'FIXED'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENT: 'Foizli chegirma',
  FIXED: 'Aniq summa',
};

export interface DiscountRule {
  id: string;
  type: DiscountType;
  /** PERCENT uchun 1–100 (foiz), FIXED uchun so'mdagi summa. */
  value: number;
  /** Ikki chegirma bir xil narx bersa, priority kattasi tanlanadi. */
  priority?: number;
}

export interface DiscountSchedule {
  isActive: boolean;
  startsAt: Date;
  endsAt: Date | null;
}

export interface PriceResult {
  /** Chegirmasiz narx */
  basePrice: number;
  /** Mijoz to'laydigan narx */
  finalPrice: number;
  /** 1 birlik uchun chegirma summasi */
  discountAmount: number;
  /** Ko'rsatish uchun foiz (summali chegirmada ham hisoblanadi), masalan 15 → "-15%" */
  discountPercent: number;
  /** Qo'llangan chegirma, yo'q bo'lsa null */
  discountId: string | null;
}

/** Chegirma qiymatining to'g'riligini tekshiradi, xato bo'lsa RangeError tashlaydi. */
export function validateDiscountRule(rule: Pick<DiscountRule, 'type' | 'value'>): void {
  if (!Number.isSafeInteger(rule.value) || rule.value <= 0) {
    throw new RangeError(
      `Chegirma qiymati musbat butun son bo'lishi kerak, berildi: ${rule.value}`,
    );
  }
  if (rule.type === 'PERCENT' && rule.value > 100) {
    throw new RangeError(`Foizli chegirma 100% dan oshmasligi kerak, berildi: ${rule.value}`);
  }
}

/** Chegirma hozir amalda ekanini tekshiradi: boshlangan va hali tugamagan. */
export function isDiscountActive(schedule: DiscountSchedule, now: Date = new Date()): boolean {
  if (!schedule.isActive) return false;
  if (schedule.startsAt.getTime() > now.getTime()) return false;
  return schedule.endsAt === null || now.getTime() < schedule.endsAt.getTime();
}

/**
 * Bitta chegirmani narxga qo'llaydi.
 * 100 000 × 15% → 85 000; 100 000 − 20 000 → 80 000. Natija hech qachon 0 dan kichik bo'lmaydi.
 */
export function applyDiscount(
  basePrice: number,
  rule: Pick<DiscountRule, 'type' | 'value'>,
): number {
  assertSom(basePrice, 'Asosiy narx');
  validateDiscountRule(rule);
  const discount =
    rule.type === 'PERCENT' ? Math.round((basePrice * rule.value) / 100) : rule.value;
  return Math.max(0, basePrice - discount);
}

/** Ikki narx orasidagi chegirma foizi (ko'rsatish uchun yaxlitlangan). */
export function discountPercentOf(basePrice: number, finalPrice: number): number {
  if (basePrice <= 0 || finalPrice >= basePrice) return 0;
  return Math.round(((basePrice - finalPrice) / basePrice) * 100);
}

/**
 * Mahsulotga tegishli chegirmalardan mijoz uchun eng foydalisini tanlaydi.
 * Chegirmalar ustma-ust qo'shilmaydi.
 */
export function calculatePrice(basePrice: number, rules: readonly DiscountRule[]): PriceResult {
  assertSom(basePrice, 'Asosiy narx');

  let best: { rule: DiscountRule; finalPrice: number } | null = null;
  for (const rule of rules) {
    const finalPrice = applyDiscount(basePrice, rule);
    if (finalPrice >= basePrice) continue;
    const isBetter =
      best === null ||
      finalPrice < best.finalPrice ||
      (finalPrice === best.finalPrice && (rule.priority ?? 0) > (best.rule.priority ?? 0));
    if (isBetter) best = { rule, finalPrice };
  }

  if (best === null) {
    return {
      basePrice,
      finalPrice: basePrice,
      discountAmount: 0,
      discountPercent: 0,
      discountId: null,
    };
  }
  return {
    basePrice,
    finalPrice: best.finalPrice,
    discountAmount: basePrice - best.finalPrice,
    discountPercent: discountPercentOf(basePrice, best.finalPrice),
    discountId: best.rule.id,
  };
}
