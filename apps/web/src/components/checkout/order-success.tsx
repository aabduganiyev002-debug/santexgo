'use client';

import {
  DELIVERY_METHOD_LABELS,
  formatUzPhone,
  type OrderDetailView,
  PAYMENT_METHOD_LABELS,
} from '@santexgo/shared';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Copy, Phone } from 'lucide-react';
import Link from 'next/link';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { Alert } from '@santexgo/ui/alert';
import { buttonClass } from '@santexgo/ui/button';
import { Skeleton } from '@santexgo/ui/skeleton';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { formatDateTime, formatSom } from '@santexgo/ui/format';
import { toast } from '@santexgo/ui/toast';

/** "Buyurtmangiz qabul qilindi": raqam (ORDER-10254), tarkib, summa va keyingi qadam. */
export function OrderSuccess({
  number,
  storePhone,
}: {
  number: string;
  storePhone: string | null;
}) {
  const query = useQuery({
    queryKey: ['account', 'orders', number],
    queryFn: () => api<OrderDetailView>(`/orders/${encodeURIComponent(number)}`),
  });

  if (query.isPending) {
    return (
      <div className="card space-y-4 p-6">
        <Skeleton className="mx-auto h-16 w-16 rounded-full" />
        <Skeleton className="mx-auto h-7 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (query.error) return <Alert tone="error">{errorMessage(query.error)}</Alert>;

  const order = query.data;
  const address = order.address;
  return (
    <div className="space-y-4">
      <section className="card flex flex-col items-center p-6 text-center sm:p-8">
        <CheckCircle2 className="h-16 w-16 text-success" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Rahmat! Buyurtmangiz qabul qilindi
        </h1>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2">
          <span className="text-sm text-slate-500">Buyurtma raqami:</span>
          <span className="tabular text-lg font-bold">{order.number}</span>
          <button
            type="button"
            className="rounded-lg p-1 text-slate-500 hover:bg-white hover:text-brand-700"
            aria-label="Raqamdan nusxa olish"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(order.number)
                .then(() => toast.success('Nusxa olindi'));
            }}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-4 max-w-md text-slate-600">
          Operatorimiz tez orada <strong>{formatUzPhone(order.customer.phone)}</strong> raqamiga
          qo‘ng‘iroq qilib, buyurtmani tasdiqlaydi.
        </p>
        {storePhone ? (
          <a
            href={`tel:${storePhone}`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Savollar bo‘lsa: {formatUzPhone(storePhone)}
          </a>
        ) : null}
      </section>

      <section className="card divide-y divide-slate-100" aria-label="Buyurtma tafsilotlari">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4">
          <span className="text-sm text-slate-500">{formatDateTime(order.createdAt)}</span>
          <OrderStatusBadge status={order.status} />
        </div>
        <ul className="space-y-3 p-4">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center gap-3 text-sm">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-white">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan WebP rasm
                  <img src={item.imageUrl} alt="" className="h-full w-full object-contain p-0.5" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 leading-5">{item.name}</p>
                <p className="tabular text-xs text-slate-500">
                  {item.quantity} × {formatSom(item.finalUnitPrice)}
                </p>
              </div>
              <span className="tabular font-semibold">{formatSom(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Qabul qiluvchi</dt>
            <dd className="font-medium">
              {order.customer.firstName} {order.customer.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{DELIVERY_METHOD_LABELS[order.deliveryMethod]}</dt>
            <dd className="font-medium">
              {address
                ? [address.region, address.district, address.street, address.house]
                    .filter(Boolean)
                    .join(', ')
                : 'Do‘kondan'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">To‘lov</dt>
            <dd className="font-medium">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</dd>
          </div>
          {order.comment ? (
            <div>
              <dt className="text-slate-500">Izoh</dt>
              <dd className="font-medium">{order.comment}</dd>
            </div>
          ) : null}
        </dl>
        <dl className="space-y-2 p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Mahsulotlar</dt>
            <dd className="tabular">{formatSom(order.subtotal)}</dd>
          </div>
          {order.discountTotal > 0 ? (
            <div className="flex justify-between">
              <dt className="text-slate-600">Chegirma</dt>
              <dd className="tabular text-sale">−{formatSom(order.discountTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-slate-600">Yetkazib berish</dt>
            <dd className="tabular">
              {order.deliveryFee > 0 ? formatSom(order.deliveryFee) : 'Bepul'}
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
            <dt className="font-semibold">Jami</dt>
            <dd className="tabular text-xl font-extrabold">{formatSom(order.total)}</dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href={`/account/orders/${order.number}`} className={buttonClass('primary', 'lg')}>
          Buyurtmani kuzatish
        </Link>
        <Link href="/catalog" className={buttonClass('outline', 'lg')}>
          Xaridni davom ettirish
        </Link>
      </div>
    </div>
  );
}
