import type { CartSummary } from '@santexgo/shared';
import { Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@santexgo/ui/cn';
import { formatSom } from '@santexgo/ui/format';

/** Savatcha va checkout'dagi hisob: mahsulotlar, chegirma, yetkazib berish, jami. */
export function OrderSummary({
  summary,
  deliveryLabel = 'Yetkazib berish',
  stale,
  children,
  className,
}: {
  summary: CartSummary;
  deliveryLabel?: string;
  /** Hisob yangilanmoqda — raqamlar xira ko'rsatiladi */
  stale?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const progress =
    summary.freeDeliveryFrom && summary.freeDeliveryRemaining > 0
      ? Math.min(100, Math.round((summary.itemsTotal / summary.freeDeliveryFrom) * 100))
      : null;
  return (
    <section className={cn('card space-y-4 p-5', className)} aria-label="Buyurtma summasi">
      <dl
        className={cn('space-y-2.5 text-sm transition-opacity', stale && 'opacity-60')}
        aria-busy={stale || undefined}
      >
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">Mahsulotlar ({summary.itemsCount})</dt>
          <dd className="tabular font-medium">{formatSom(summary.subtotal)}</dd>
        </div>
        {summary.discountTotal > 0 ? (
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Chegirma</dt>
            <dd className="tabular font-medium text-sale">−{formatSom(summary.discountTotal)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">{deliveryLabel}</dt>
          <dd className="tabular font-medium">
            {summary.deliveryFee > 0 ? (
              formatSom(summary.deliveryFee)
            ) : (
              <span className="text-success">Bepul</span>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-slate-100 pt-3">
          <dt className="text-base font-semibold">Jami</dt>
          <dd className="tabular text-2xl font-extrabold tracking-tight">
            {formatSom(summary.total)}
          </dd>
        </div>
      </dl>

      {progress !== null ? (
        <div className="space-y-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
          <p className="flex items-center gap-2">
            <Truck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Bepul yetkazib berishgacha yana{' '}
              <strong className="tabular">{formatSom(summary.freeDeliveryRemaining)}</strong>
            </span>
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-brand-100">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {children}
    </section>
  );
}
