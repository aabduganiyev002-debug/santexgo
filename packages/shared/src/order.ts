export const ORDER_STATUSES = [
  'RECEIVED',
  'CONFIRMING',
  'PREPARING',
  'DELIVERING',
  'DELIVERED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: 'Buyurtma qabul qilindi',
  CONFIRMING: 'Tasdiqlanmoqda',
  PREPARING: 'Tayyorlanmoqda',
  DELIVERING: 'Yetkazib berilmoqda',
  DELIVERED: 'Yetkazildi',
  CANCELLED: 'Bekor qilindi',
};

/**
 * Ruxsat etilgan status o'tishlari. Status faqat oldinga yuradi;
 * yo'lga chiqqan (DELIVERING) buyurtmani bekor qilib bo'lmaydi.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  RECEIVED: ['CONFIRMING', 'CANCELLED'],
  CONFIRMING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['DELIVERING', 'CANCELLED'],
  DELIVERING: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Mijoz o'zi bekor qila oladigan statuslar. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderStatus[] = ['RECEIVED'];

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function isFinalOrderStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[status].length === 0;
}

export const ORDER_NUMBER_PREFIX = 'ORDER-';
/** Birinchi buyurtma raqami (bazadagi sequence shu qiymatdan boshlanadi). */
export const ORDER_NUMBER_START = 10001;

/** 10254 → "ORDER-10254" */
export function formatOrderNumber(orderNumber: number): string {
  return `${ORDER_NUMBER_PREFIX}${orderNumber}`;
}

/** "ORDER-10254", "#order-10254" yoki "10254" → 10254; noto'g'ri bo'lsa null. */
export function parseOrderNumber(input: string): number | null {
  const match = /^#?\s*(?:order-)?(\d{1,10})$/i.exec(input.trim());
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export const DELIVERY_METHODS = ['DELIVERY', 'PICKUP'] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  DELIVERY: 'Yetkazib berish',
  PICKUP: 'Do‘kondan olib ketish',
};

export const PAYMENT_METHODS = ['CASH', 'CARD_ON_DELIVERY', 'CLICK', 'PAYME', 'UZUM'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Naqd pul',
  CARD_ON_DELIVERY: 'Yetkazilganda karta orqali',
  CLICK: 'Click',
  PAYME: 'Payme',
  UZUM: 'Uzum Bank',
};

/** Onlayn to'lov tizimlari (keyingi bosqichlarda ulanadi). */
export const ONLINE_PAYMENT_METHODS: readonly PaymentMethod[] = ['CLICK', 'PAYME', 'UZUM'];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'To‘lov kutilmoqda',
  PAID: 'To‘langan',
  FAILED: 'To‘lov amalga oshmadi',
  REFUNDED: 'Qaytarildi',
  CANCELLED: 'Bekor qilindi',
};
