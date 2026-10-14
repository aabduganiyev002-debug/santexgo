import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

/**
 * Ombor holati (qism-butun): sotuvda bor / kam qolgan / sotuvda yo'q. Status ranglari
 * faqat ikon va yozuv bilan birga; segmentlar orasida 2px oq tirqish.
 */
export function StockMeter({
  inStock,
  lowStock,
  outOfStock,
}: {
  inStock: number;
  lowStock: number;
  outOfStock: number;
}) {
  const ok = Math.max(0, inStock - lowStock);
  const total = ok + lowStock + outOfStock;
  const segments = [
    {
      key: 'ok',
      label: 'Yetarli',
      value: ok,
      color: 'var(--viz-status-good)',
      icon: CheckCircle2,
      href: '/products?stock=in&status=active',
    },
    {
      key: 'low',
      label: 'Kam qolgan',
      value: lowStock,
      color: 'var(--viz-status-warning)',
      icon: AlertTriangle,
      href: '/products?stock=low&status=active&sort=stock_asc',
    },
    {
      key: 'out',
      label: 'Sotuvda yo‘q',
      value: outOfStock,
      color: 'var(--viz-status-critical)',
      icon: XCircle,
      href: '/products?stock=out&status=active',
    },
  ];
  return (
    <div className="viz-root space-y-3">
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.key}
              style={{ width: `${(s.value / Math.max(total, 1)) * 100}%`, background: s.color }}
              title={`${s.label}: ${s.value}`}
            />
          ))}
      </div>
      <ul className="grid grid-cols-3 gap-2 text-sm">
        {segments.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.key}>
              <Link href={s.href} className="block rounded-lg p-2 hover:bg-slate-50">
                <span className="flex items-center gap-1.5 text-[var(--viz-text-secondary)]">
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={{ color: s.color }}
                    aria-hidden="true"
                  />
                  {s.label}
                </span>
                <span className="mt-0.5 block text-xl font-semibold text-[var(--viz-text-primary)]">
                  {s.value}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
