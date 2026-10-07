import { ORDER_STATUS_LABELS, type OrderStatus } from '@santexgo/shared';
import { cn } from '@santexgo/ui/cn';

const TONES: Record<OrderStatus, string> = {
  RECEIVED: 'bg-brand-50 text-brand-700',
  CONFIRMING: 'bg-amber-50 text-amber-700',
  PREPARING: 'bg-violet-50 text-violet-700',
  DELIVERING: 'bg-sky-50 text-sky-700',
  DELIVERED: 'bg-success-soft text-success',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        TONES[status],
        className,
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
