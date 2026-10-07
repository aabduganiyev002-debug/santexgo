'use client';

import {
  type CartView,
  DELIVERY_METHOD_LABELS,
  formatUzPhone,
  type OrderDetailView,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@santexgo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { OrderTimeline } from '@/components/orders/order-timeline';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { formatDateTime, formatSom, unitLabel } from '@/lib/format';
import { lineFromView, useCart } from '@/lib/stores/cart';
import { toast } from '@/lib/stores/toast';

/** Buyurtma tafsiloti: holat bosqichlari, mahsulotlar, manzil, to'lov, bekor qilish, qayta buyurtma. */
export function OrderDetail({ number }: { number: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const key = ['account', 'orders', number];

  const query = useQuery({
    queryKey: key,
    queryFn: () => api<OrderDetailView>(`/orders/${encodeURIComponent(number)}`),
  });

  const cancel = useMutation({
    mutationFn: () =>
      api<OrderDetailView>(`/orders/${encodeURIComponent(number)}/cancel`, {
        method: 'POST',
        body: { reason: reason.trim() || undefined },
      }),
    onSuccess: (order) => {
      queryClient.setQueryData(key, order);
      void queryClient.invalidateQueries({ queryKey: ['account'] });
      setCancelOpen(false);
      toast.success('Buyurtma bekor qilindi');
    },
  });

  const reorder = useMutation({
    mutationFn: (order: OrderDetailView) =>
      api<CartView>('/cart/preview', {
        method: 'POST',
        body: {
          items: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      }),
    onSuccess: (view) => {
      const available = view.lines.filter((line) => line.issue !== 'OUT_OF_STOCK');
      useCart.getState().addLines(available.map(lineFromView));
      const missing = view.lines.length - available.length + view.unavailableProductIds.length;
      if (available.length === 0) {
        toast.error('Bu buyurtmadagi mahsulotlar hozir sotuvda yo‘q');
        return;
      }
      toast.success(
        missing > 0
          ? `${available.length} ta mahsulot savatchaga qo‘shildi, ${missing} tasi sotuvda yo‘q`
          : 'Mahsulotlar savatchaga qo‘shildi',
        { label: 'Savatcha', href: '/cart' },
      );
      router.push('/cart');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (query.error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert tone="error">{errorMessage(query.error)}</Alert>
      </div>
    );
  }

  const order = query.data;
  const address = order.address;
  return (
    <div className="space-y-4">
      <BackLink />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="tabular text-2xl font-extrabold tracking-tight sm:text-3xl">
            {order.number}
          </h1>
          <p className="text-sm text-slate-500">{formatDateTime(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </div>

      <section className="card p-4 sm:p-6" aria-label="Buyurtma holati">
        <OrderTimeline
          status={order.status}
          history={order.history}
          cancelReason={order.cancelReason}
        />
      </section>

      <section className="card divide-y divide-slate-100" aria-label="Mahsulotlar">
        <h2 className="p-4 font-semibold">Mahsulotlar ({order.itemsCount} dona)</h2>
        <ul>
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center gap-3 p-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan WebP rasm
                  <img src={item.imageUrl} alt="" className="h-full w-full object-contain p-1" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-xs font-semibold uppercase text-slate-500">{item.brandName}</p>
                {item.slug ? (
                  <Link
                    href={`/products/${item.slug}`}
                    className="line-clamp-2 font-medium hover:text-brand-700"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <p className="line-clamp-2 font-medium">{item.name}</p>
                )}
                <p className="tabular text-slate-500">
                  {item.quantity} {unitLabel(item.unit)} × {formatSom(item.finalUnitPrice)}
                  {item.discountAmount > 0 ? (
                    <s className="ml-2 text-slate-400">{formatSom(item.unitPrice)}</s>
                  ) : null}
                </p>
              </div>
              <p className="tabular shrink-0 font-bold">{formatSom(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 p-4 text-sm">
          <Row label="Mahsulotlar" value={formatSom(order.subtotal)} />
          {order.discountTotal > 0 ? (
            <Row
              label="Chegirma"
              value={<span className="text-sale">−{formatSom(order.discountTotal)}</span>}
            />
          ) : null}
          <Row
            label="Yetkazib berish"
            value={order.deliveryFee > 0 ? formatSom(order.deliveryFee) : 'Bepul'}
          />
          <div className="flex items-baseline justify-between border-t border-slate-100 pt-2">
            <dt className="font-semibold">Jami</dt>
            <dd className="tabular text-xl font-extrabold">{formatSom(order.total)}</dd>
          </div>
        </dl>
      </section>

      <section className="card grid gap-4 p-4 text-sm sm:grid-cols-2" aria-label="Ma’lumotlar">
        <Info label="Qabul qiluvchi">
          {order.customer.firstName} {order.customer.lastName}
          <br />
          {formatUzPhone(order.customer.phone)}
        </Info>
        <Info label={DELIVERY_METHOD_LABELS[order.deliveryMethod]}>
          {address
            ? [
                address.region,
                address.district,
                [address.street, address.house].filter(Boolean).join(', '),
                address.apartment ? `${address.apartment}-xonadon` : null,
                address.landmark ? `Mo‘ljal: ${address.landmark}` : null,
              ]
                .filter(Boolean)
                .join(', ')
            : 'Do‘kondan olib ketiladi'}
        </Info>
        <Info label="To‘lov">
          {PAYMENT_METHOD_LABELS[order.paymentMethod]} ·{' '}
          {PAYMENT_STATUS_LABELS[order.paymentStatus]}
        </Info>
        {order.comment ? <Info label="Izoh">{order.comment}</Info> : null}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" loading={reorder.isPending} onClick={() => reorder.mutate(order)}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Qayta buyurtma berish
        </Button>
        {order.canCancel ? (
          <Button variant="ghostDanger" onClick={() => setCancelOpen(true)}>
            Buyurtmani bekor qilish
          </Button>
        ) : null}
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Buyurtmani bekor qilish">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            cancel.mutate();
          }}
        >
          <p className="text-sm text-slate-600">
            {order.number} buyurtmasi bekor qilinadi. Sababini yozsangiz, xizmatimizni yaxshilashga
            yordam beradi.
          </p>
          <textarea
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Masalan: boshqa joydan oldim"
            aria-label="Bekor qilish sababi"
            className={inputClass(false, 'h-auto py-2.5')}
          />
          {cancel.error ? <Alert tone="error">{errorMessage(cancel.error)}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Ortga
            </Button>
            <Button type="submit" variant="danger" loading={cancel.isPending}>
              Bekor qilish
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/account/orders"
      className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-brand-700"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Buyurtmalarim
    </Link>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-600">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium">{children}</p>
    </div>
  );
}
