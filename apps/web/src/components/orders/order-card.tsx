import type { OrderSummaryView } from '@santexgo/shared';
import { ChevronRight, Package } from 'lucide-react';
import Link from 'next/link';
import { formatDateTime, formatSom } from '@santexgo/ui/format';
import { OrderStatusBadge } from './order-status-badge';

/** Buyurtmalar ro'yxatidagi kartochka: raqam, sana, holat, mahsulot rasmlari, summa. */
export function OrderCard({ order }: { order: OrderSummaryView }) {
  return (
    <Link
      href={`/account/orders/${order.number}`}
      className="card group flex flex-col gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-pop)] sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="tabular font-bold">{order.number}</span>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-sm text-slate-500">
          {formatDateTime(order.createdAt)} · {order.itemsCount} dona
        </p>
        <div className="flex gap-2">
          {order.previewImages.length > 0 ? (
            order.previewImages.map((src, index) => (
              <span
                key={`${index}-${src}`}
                className="h-12 w-12 overflow-hidden rounded-lg border border-slate-100 bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan WebP rasm */}
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-contain p-0.5"
                  loading="lazy"
                />
              </span>
            ))
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-50 text-slate-300">
              <Package className="h-6 w-6" aria-hidden="true" />
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <span className="tabular text-lg font-extrabold">{formatSom(order.total)}</span>
        <span className="inline-flex items-center text-sm font-medium text-brand-700">
          Batafsil
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
