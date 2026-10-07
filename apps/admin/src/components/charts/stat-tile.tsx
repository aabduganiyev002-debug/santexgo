import { cn } from '@santexgo/ui/cn';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import Link from 'next/link';

/** Foiz o'zgarish (oldingi davrga nisbatan); oldingi davr 0 bo'lsa — null. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Stat tile: nom · qiymat (proporsional raqamlar) · o'zgarish (nomlangan davrga nisbatan,
 * yo'nalish ikon bilan — rang yagona belgi emas).
 */
export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  href,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  hint?: string;
  href?: string;
}) {
  const Icon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const body = (
    <>
      <p className="text-sm text-[var(--viz-text-secondary)]">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-[var(--viz-text-primary)]">
        {value}
      </p>
      {deltaLabel ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--viz-text-secondary)]">
          <span
            className={cn(
              'inline-flex items-center font-semibold',
              delta != null && delta > 0 && 'text-[var(--viz-delta-up)]',
              delta != null && delta < 0 && 'text-[var(--viz-delta-down)]',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
          </span>
          {deltaLabel}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-[var(--viz-text-secondary)]">{hint}</p>
      ) : null}
    </>
  );
  const className = 'card viz-root block p-4';
  return href ? (
    <Link
      href={href}
      className={cn(className, 'transition-shadow hover:shadow-[var(--shadow-pop)]')}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
