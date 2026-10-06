/** Saqlash formati: +998 va 9 ta raqam (E.164), masalan +998901234567. */
export const UZ_PHONE_REGEX = /^\+998[1-9]\d{8}$/;

/**
 * Har xil yozilgan O'zbekiston raqamini yagona formatga keltiradi.
 * "90 123 45 67", "998901234567", "+998 (90) 123-45-67" → "+998901234567".
 * Noto'g'ri raqam uchun null qaytaradi.
 */
export function normalizeUzPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let local: string;
  if (digits.length === 12 && digits.startsWith('998')) {
    local = digits.slice(3);
  } else if (digits.length === 9) {
    local = digits;
  } else {
    return null;
  }
  const phone = `+998${local}`;
  return UZ_PHONE_REGEX.test(phone) ? phone : null;
}

export function isValidUzPhone(input: string): boolean {
  return normalizeUzPhone(input) !== null;
}

/** "+998901234567" → "+998 90 123 45 67" */
export function formatUzPhone(input: string): string {
  const phone = normalizeUzPhone(input);
  if (phone === null) return input;
  const d = phone.slice(4);
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/** Loglar va bildirishnomalar uchun: "+998901234567" → "+998 90 *** ** 67" */
export function maskUzPhone(input: string): string {
  const phone = normalizeUzPhone(input);
  if (phone === null) return '***';
  const d = phone.slice(4);
  return `+998 ${d.slice(0, 2)} *** ** ${d.slice(7, 9)}`;
}
