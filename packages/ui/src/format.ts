import { formatSom, PRODUCT_UNIT_LABELS, type ProductUnit } from '@santexgo/shared';

export { formatSom };

export function unitLabel(unit: ProductUnit): string {
  return PRODUCT_UNIT_LABELS[unit];
}

/** "12 ta mahsulot" */
export function countLabel(count: number, noun = 'mahsulot'): string {
  return `${count.toLocaleString('ru-RU').replace(/,/g, ' ')} ta ${noun}`;
}

/** Chegirma tugashiga qolgan vaqt: "3 kun", "5 soat" */
export function timeLeft(isoDate: string, now: number = Date.now()): string | null {
  const ms = new Date(isoDate).getTime() - now;
  if (ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 48) return `${Math.floor(hours / 24)} kun`;
  if (hours >= 1) return `${hours} soat`;
  return `${Math.max(1, Math.floor(ms / 60_000))} daqiqa`;
}

const DATE_PARTS = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Tashkent',
});

function parts(iso: string): Record<string, string> {
  return Object.fromEntries(
    DATE_PARTS.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
}

/** "12.10.2026" (Toshkent vaqti bilan) */
export function formatDate(iso: string): string {
  const p = parts(iso);
  return `${p.day}.${p.month}.${p.year}`;
}

/** "12.10.2026, 14:05" */
export function formatDateTime(iso: string): string {
  const p = parts(iso);
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
}
