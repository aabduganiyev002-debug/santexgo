'use client';

import {
  type AdminOrderDetail,
  DELIVERY_METHOD_LABELS,
  formatUzPhone,
  ORDER_STATUS_LABELS,
  type OrderStatus,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Button } from '@santexgo/ui/button';
import { cn } from '@santexgo/ui/cn';
import { inputClass } from '@santexgo/ui/field';
import { formatDateTime, formatSom, unitLabel } from '@santexgo/ui/format';
import { Modal } from '@santexgo/ui/modal';
import { OrderStatusBadge } from '@santexgo/ui/order-status-badge';
import { toast } from '@santexgo/ui/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Phone, Printer } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { ErrorState, TableSkeleton } from '@/components/data/states';
import { PageHeader } from '@/components/page-header';
import { SITE_URL } from '@/lib/config';

const TRANSITION_HINTS: Partial<Record<OrderStatus, string>> = {
  DELIVERING: 'Band qilingan mahsulot ombordan chiqadi',
  DELIVERED: 'Sotilganlar soni oshadi; naqd/karta to‘lovi “to‘langan” bo‘ladi',
  CANCELLED: 'Band bo‘shaydi; yo‘lga chiqqan bo‘lsa mahsulot omborga qaytadi',
};

export function OrderDetail({ number }: { number: string }) {
  const queryClient = useQueryClient();
  const key = ['admin', 'orders', 'detail', number];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(number)}`),
  });
  const onUpdated = (order: AdminOrderDetail) => {
    queryClient.setQueryData(key, order);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'], refetchType: 'none' });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'orders', 'new-count'] });
  };

  if (query.isPending) return <TableSkeleton rows={8} />;
  if (query.error) return <ErrorState error={query.error} />;
  const order = query.data;
  const address = order.address;

  return (
    <div>
      <PageHeader
        back={{ href: '/orders', label: 'Buyurtmalar' }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="tabular">{order.number}</span>
            <OrderStatusBadge status={order.status} className="text-sm" />
          </span>
        }
        description={`${formatDateTime(order.createdAt)} · ${order.itemsCount} dona · ${formatSom(order.total)}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            Chop etish
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="card overflow-x-auto" aria-label="Mahsulotlar">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mahsulot</th>
                  <th className="text-right">Narx</th>
                  <th className="text-right">Miqdor</th>
                  <th className="text-right">Summa</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.productId}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-white">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan WebP rasm
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/products/${item.productId}`}
                            className="font-medium hover:text-brand-700"
                          >
                            {item.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {item.brandName} · SKU {item.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="tabular whitespace-nowrap text-right">
                      {formatSom(item.finalUnitPrice)}
                      {item.discountAmount > 0 ? (
                        <s className="block text-xs text-slate-400">{formatSom(item.unitPrice)}</s>
                      ) : null}
                    </td>
                    <td className="tabular whitespace-nowrap text-right">
                      {item.quantity} {unitLabel(item.unit)}
                    </td>
                    <td className="tabular whitespace-nowrap text-right font-semibold">
                      {formatSom(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="ml-auto max-w-xs space-y-1.5 p-4 text-sm">
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
              <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold">
                <dt>Jami</dt>
                <dd className="tabular">{formatSom(order.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-4" aria-label="Status tarixi">
            <h2 className="mb-3 font-semibold">Holat tarixi</h2>
            <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
              {order.history.map((entry, index) => (
                <li key={`${entry.status}-${index}`} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-600" />
                  <p className="font-medium">{ORDER_STATUS_LABELS[entry.status]}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(entry.createdAt)}
                    {entry.changedBy ? ` · ${entry.changedBy}` : ''}
                  </p>
                  {entry.note ? <p className="mt-0.5 text-slate-600">{entry.note}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-4">
          <StatusCard order={order} onUpdated={onUpdated} />

          <Card title="Mijoz">
            <p className="font-medium">
              {order.customer.firstName} {order.customer.lastName}
            </p>
            <a
              href={`tel:${order.customer.phone}`}
              className="tabular inline-flex items-center gap-1.5 text-brand-700 hover:underline"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {formatUzPhone(order.customer.phone)}
            </a>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-slate-500">Akkaunt</p>
              <Link
                href={`/customers/${order.user.id}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {order.user.firstName} {order.user.lastName} · {formatUzPhone(order.user.phone)}
              </Link>
              <p className="mt-1 text-slate-600">
                {order.user.ordersCount} ta buyurtma · {formatSom(order.user.totalSpent)} xarid
              </p>
            </div>
          </Card>

          <Card title={DELIVERY_METHOD_LABELS[order.deliveryMethod]}>
            {address ? (
              <p className="text-sm">
                {[
                  address.region,
                  address.district,
                  [address.street, address.house].filter(Boolean).join(', '),
                  address.apartment ? `${address.apartment}-xonadon` : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
                {address.landmark ? (
                  <span className="block text-slate-500">Mo‘ljal: {address.landmark}</span>
                ) : null}
              </p>
            ) : (
              <p className="text-sm text-slate-600">Mijoz do‘kondan olib ketadi</p>
            )}
            {order.comment ? (
              <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Mijoz izohi</p>
                <p>{order.comment}</p>
              </div>
            ) : null}
          </Card>

          <PaymentCard order={order} onUpdated={onUpdated} />
          <NoteCard order={order} onUpdated={onUpdated} />

          <a
            href={`${SITE_URL}/account/orders/${order.number}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Mijoz ko‘rinishi (saytda)
          </a>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  order,
  onUpdated,
}: {
  order: AdminOrderDetail;
  onUpdated: (order: AdminOrderDetail) => void;
}) {
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState('');
  const change = useMutation({
    mutationFn: (status: OrderStatus) =>
      api<AdminOrderDetail>(`/admin/orders/${order.number}/status`, {
        method: 'PATCH',
        body: { status, note: note.trim() || undefined },
      }),
    onSuccess: (updated) => {
      onUpdated(updated);
      toast.success(`Holat: ${ORDER_STATUS_LABELS[updated.status]}`);
      setTarget(null);
      setNote('');
    },
  });

  if (order.allowedTransitions.length === 0) {
    return (
      <Card title="Holat">
        <p className="text-sm text-slate-600">
          Buyurtma yakunlangan ({ORDER_STATUS_LABELS[order.status].toLowerCase()}) — holatini
          o‘zgartirib bo‘lmaydi.
        </p>
        {order.cancelReason ? (
          <p className="mt-2 text-sm text-slate-500">Sabab: {order.cancelReason}</p>
        ) : null}
      </Card>
    );
  }

  const forward = order.allowedTransitions.filter((s) => s !== 'CANCELLED');
  const canCancel = order.allowedTransitions.includes('CANCELLED');
  const [next, ...rest] = forward;
  return (
    <Card title="Holatni o‘zgartirish">
      <div className="space-y-2">
        {next ? (
          <Button fullWidth onClick={() => setTarget(next)}>
            {ORDER_STATUS_LABELS[next]}
          </Button>
        ) : null}
        {rest.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {rest.map((status) => (
              <Button key={status} variant="outline" size="sm" onClick={() => setTarget(status)}>
                {ORDER_STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        ) : null}
        {canCancel ? (
          <Button variant="ghostDanger" size="sm" onClick={() => setTarget('CANCELLED')}>
            Bekor qilish
          </Button>
        ) : null}
      </div>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target ? `“${ORDER_STATUS_LABELS[target]}” holatiga o‘tkazish` : ''}
      >
        {target ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              change.mutate(target);
            }}
          >
            {TRANSITION_HINTS[target] ? (
              <Alert tone="info">{TRANSITION_HINTS[target]}</Alert>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">
                {target === 'CANCELLED' ? 'Bekor qilish sababi' : 'Izoh (ixtiyoriy, ichki)'}
              </span>
              <textarea
                rows={3}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required={target === 'CANCELLED'}
                className={inputClass(false, 'h-auto py-2.5')}
              />
            </label>
            {change.error ? <Alert tone="error">{errorMessage(change.error)}</Alert> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setTarget(null)}>
                Ortga
              </Button>
              <Button
                type="submit"
                variant={target === 'CANCELLED' ? 'danger' : 'primary'}
                loading={change.isPending}
              >
                Tasdiqlash
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </Card>
  );
}

function PaymentCard({
  order,
  onUpdated,
}: {
  order: AdminOrderDetail;
  onUpdated: (order: AdminOrderDetail) => void;
}) {
  const update = useMutation({
    mutationFn: (paymentStatus: 'PENDING' | 'PAID' | 'REFUNDED') =>
      api<AdminOrderDetail>(`/admin/orders/${order.number}`, {
        method: 'PATCH',
        body: { paymentStatus },
      }),
    onSuccess: (updated) => {
      onUpdated(updated);
      toast.success(`To‘lov: ${PAYMENT_STATUS_LABELS[updated.paymentStatus]}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Card title="To‘lov">
      <p className="text-sm">
        {PAYMENT_METHOD_LABELS[order.paymentMethod]} ·{' '}
        <span
          className={cn(
            'font-semibold',
            order.paymentStatus === 'PAID' ? 'text-success' : 'text-slate-700',
          )}
        >
          {PAYMENT_STATUS_LABELS[order.paymentStatus]}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {order.paymentStatus === 'PENDING' && order.status !== 'CANCELLED' ? (
          <Button
            size="sm"
            variant="outline"
            loading={update.isPending}
            onClick={() => update.mutate('PAID')}
          >
            To‘landi deb belgilash
          </Button>
        ) : null}
        {order.paymentStatus === 'PAID' ? (
          <Button
            size="sm"
            variant="ghostDanger"
            loading={update.isPending}
            onClick={() => {
              if (window.confirm('To‘lov mijozga qaytarildimi?')) update.mutate('REFUNDED');
            }}
          >
            Qaytarildi
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function NoteCard({
  order,
  onUpdated,
}: {
  order: AdminOrderDetail;
  onUpdated: (order: AdminOrderDetail) => void;
}) {
  const [note, setNote] = useState(order.adminNote ?? '');
  const save = useMutation({
    mutationFn: () =>
      api<AdminOrderDetail>(`/admin/orders/${order.number}`, {
        method: 'PATCH',
        body: { adminNote: note.trim() || null },
      }),
    onSuccess: (updated) => {
      onUpdated(updated);
      toast.success('Izoh saqlandi');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const dirty = note.trim() !== (order.adminNote ?? '');
  return (
    <Card title="Ichki izoh" hint="Faqat adminlar ko‘radi">
      <textarea
        rows={3}
        maxLength={1000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Masalan: mijoz 18:00 dan keyin uyda"
        aria-label="Ichki izoh"
        className={inputClass(false, 'h-auto py-2.5 text-sm')}
      />
      <Button
        size="sm"
        className="mt-2"
        disabled={!dirty}
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        Saqlash
      </Button>
    </Card>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="font-semibold">{title}</h2>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </section>
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
