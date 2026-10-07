'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface BarItem {
  key: string;
  label: string;
  /** Bar uzunligi shu qiymatga mutanosib */
  value: number;
  /** Bar uchidagi yozuv */
  valueLabel: string;
  /** Tooltip'dagi qo'shimcha qator */
  detail?: string;
  href?: string;
}

/**
 * Gorizontal barlar (nominal kategoriyalar: bitta rang — 1-slot). Qiymat bar uchida,
 * har bir qatorga hover/focus'da tooltip. Bar 10px qalin, ma'lumot uchi yumaloq.
 */
export function BarList({ items, empty }: { items: BarItem[]; empty: string }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...items.map((i) => i.value), 0);
  if (items.length === 0 || max === 0) {
    return <p className="py-6 text-center text-sm text-[var(--viz-text-muted)]">{empty}</p>;
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const pct = Math.max(1, (item.value / max) * 100);
        const label = item.href ? (
          <Link href={item.href} className="hover:text-brand-700 hover:underline">
            {item.label}
          </Link>
        ) : (
          item.label
        );
        return (
          <li
            key={item.key}
            tabIndex={0}
            onPointerEnter={() => setActive(item.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(item.key)}
            onBlur={() => setActive(null)}
            className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-[var(--viz-text-primary)]">{label}</span>
              <span className="tabular shrink-0 font-semibold text-[var(--viz-text-primary)]">
                {item.valueLabel}
              </span>
            </div>
            <div className="h-2.5 w-full">
              <div
                className="h-full rounded-r bg-[var(--viz-series-1)] transition-opacity"
                style={{ width: `${pct}%`, opacity: active && active !== item.key ? 0.55 : 1 }}
              />
            </div>
            {active === item.key && item.detail ? (
              <div
                role="status"
                className="pointer-events-none absolute right-0 top-full z-10 mt-1 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs text-[var(--viz-text-secondary)] shadow-[var(--shadow-pop)]"
              >
                <span className="font-semibold text-[var(--viz-text-primary)]">
                  {item.valueLabel}
                </span>{' '}
                · {item.detail}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
