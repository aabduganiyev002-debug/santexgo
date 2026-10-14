const MONTHS = [
  'yan',
  'fev',
  'mar',
  'apr',
  'may',
  'iyun',
  'iyul',
  'avg',
  'sen',
  'okt',
  'noy',
  'dek',
];

/** "2026-10-07" → "7-okt"; "2026-10" → "okt 2026" */
export function periodLabel(period: string): string {
  const [year, month, day] = period.split('-');
  const name = MONTHS[Number(month) - 1] ?? month;
  return day ? `${Number(day)}-${name}` : `${name} ${year}`;
}

/** Ixcham summa: 1 250 000 → "1,25 mln"; 12 500 → "12,5 ming" */
export function compactSom(value: number): string {
  const abs = Math.abs(value);
  const fmt = (n: number) =>
    n.toLocaleString('ru-RU', { maximumFractionDigits: n < 10 ? 2 : n < 100 ? 1 : 0 });
  if (abs >= 1e9) return `${fmt(value / 1e9)} mlrd`;
  if (abs >= 1e6) return `${fmt(value / 1e6)} mln`;
  if (abs >= 1e3) return `${fmt(value / 1e3)} ming`;
  return String(value);
}

/** Toza o'q belgilari: 0, 250 ming, 500 ming... (4–5 ta) */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
}
