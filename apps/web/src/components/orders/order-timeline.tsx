import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STEPS,
  type OrderHistoryEntry,
  type OrderStatus,
} from '@santexgo/shared';
import { Check, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';

/**
 * Buyurtma bosqichlari: o'tilganlari belgilangan, joriysi ajratilgan, vaqti ko'rsatilgan.
 * Bekor qilingan buyurtma uchun — alohida xabar.
 */
export function OrderTimeline({
  status,
  history,
  cancelReason,
}: {
  status: OrderStatus;
  history: OrderHistoryEntry[];
  cancelReason?: string | null;
}) {
  const reachedAt = new Map(history.map((entry) => [entry.status, entry.createdAt]));

  if (status === 'CANCELLED') {
    return (
      <div className="flex gap-3 rounded-xl bg-slate-100 p-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold text-slate-800">{ORDER_STATUS_LABELS.CANCELLED}</p>
          {reachedAt.get('CANCELLED') ? (
            <p className="text-slate-500">{formatDateTime(reachedAt.get('CANCELLED')!)}</p>
          ) : null}
          {cancelReason ? <p className="mt-1 text-slate-600">{cancelReason}</p> : null}
        </div>
      </div>
    );
  }

  const current = ORDER_STATUS_STEPS.indexOf(status);
  return (
    <ol className="grid gap-0 sm:grid-cols-5" aria-label="Buyurtma holati">
      {ORDER_STATUS_STEPS.map((step, index) => {
        const done = index <= current;
        const at = reachedAt.get(step);
        return (
          <li
            key={step}
            aria-current={index === current ? 'step' : undefined}
            className="relative flex gap-3 pb-5 last:pb-0 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center"
          >
            {/* Bosqichlarni bog'lovchi chiziq */}
            {index < ORDER_STATUS_STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 sm:left-[calc(50%+14px)] sm:top-[13px] sm:h-0.5 sm:w-[calc(100%-28px)]',
                  index < current ? 'bg-brand-600' : 'bg-slate-200',
                )}
              />
            ) : null}
            <span
              className={cn(
                'relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                done
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-slate-400',
                index === current && 'ring-4 ring-brand-100',
              )}
            >
              {index < current ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
            </span>
            <span className="text-sm">
              <span className={cn('block font-medium', done ? 'text-slate-900' : 'text-slate-400')}>
                {ORDER_STATUS_LABELS[step]}
              </span>
              {at ? (
                <span className="block text-xs text-slate-500">{formatDateTime(at)}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
