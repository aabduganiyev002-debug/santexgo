/**
 * Pul qiymatlari butun so'mda saqlanadi va hisoblanadi (kasr son ishlatilmaydi).
 */
export const CURRENCY = 'UZS' as const;
export const CURRENCY_LABEL = 'so‘m';

const NBSP = ' ';
const MINUS = '−';

/** Qiymat manfiy bo'lmagan xavfsiz butun son ekanini tekshiradi. */
export function isValidSom(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function assertSom(value: number, field = 'summa'): void {
  if (!isValidSom(value)) {
    throw new RangeError(
      `${field} manfiy bo'lmagan butun son (so'm) bo'lishi kerak, berildi: ${value}`,
    );
  }
}

/**
 * So'mni chiroyli ko'rinishda chiqaradi: 45000 → "45 000 so‘m".
 * Raqam guruhlari orasida bo'linmaydigan probel ishlatiladi, summa qatorga bo'linib ketmaydi.
 */
export function formatSom(value: number, options: { withCurrency?: boolean } = {}): string {
  const { withCurrency = true } = options;
  const rounded = Math.round(value);
  const sign = rounded < 0 ? MINUS : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}${digits}${withCurrency ? `${NBSP}${CURRENCY_LABEL}` : ''}`;
}
