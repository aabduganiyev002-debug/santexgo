export const PRODUCT_UNITS = ['PIECE', 'METER', 'PACK', 'SET', 'KG'] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  PIECE: 'dona',
  METER: 'metr',
  PACK: 'pachka',
  SET: 'komplekt',
  KG: 'kg',
};

export const OUT_OF_STOCK_LABEL = 'Sotuvda yo‘q';

/** Sotuvga mavjud miqdor: omborda bor minus band qilingan. */
export function availableStock(quantity: number, reserved: number): number {
  return Math.max(0, quantity - reserved);
}
