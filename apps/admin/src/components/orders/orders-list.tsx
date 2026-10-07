'use client';

import {
  type AdminOrderListResponse,
  DELIVERY_METHOD_LABELS,
  formatUzPhone,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { cn } from '@santexgo/ui/cn';
import { inputClass } from '@santexgo/ui/field';
import { formatDateTime, formatSom } from '@santexgo/ui/format';
import { OrderStatusBadge } from '@santexgo/ui/order-status-badge';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/data/states';
import { useListParams } from '@/lib/use-list-params';

const TABS = [
  { value: 'all', label: 'Barchasi' },
  { value: 'active', label: 'Faol' },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })),
];

const DEFAULTS = { q: '', status: 'all', from: '', to: '', userId: '', page: '1' };

/** Kun boshidan / oxirigacha (Toshkent vaqti bilan) — sana filtri uchun */
function dayBound(date: string, end: boolean): string {
  return `${date}T${end ? '23:59:59.999' : '00:00:00'}+05:00`;
}

export function OrdersList() {
  const router = useRouter();
  const { values, update } = useListParams(DEFAULTS);
  const search = new URLSearchParams();
  if (values.q) search.set('q', values.q);
  if (values.status !== 'all') search.set('status', values.status);
  if (values.from) search.set('from', dayBound(values.from, false));
  if (values.to) search.set('to', dayBound(values.to, true));
  if (values.userId) search.set('userId', values.userId);
  search.set('page', values.page);

  const query = useQuery({
    queryKey: ['admin', 'orders', 'list', search.toString()],
    queryFn: () => api<AdminOrderListResponse>(`/admin/orders?${search}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const counts = query.data?.statusCounts;
  const activeCount = counts
    ? counts.RECEIVED + counts.CONFIRMING + counts.PREPARING + counts.DELIVERING
    : null;
  const totalCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;

  return (
    <div>
      <PageHeader title="Buyurtmalar" description="Yangi buyurtmalar har daqiqada yangilanadi" />

      <div className="scroll-row mb-3">
        {TABS.map((tab) => {
          const count =
            tab.value === 'all'
              ? totalCount
              : tab.value === 'active'
                ? activeCount
                : (counts?.[tab.value as keyof typeof counts] ?? null);
          const active = values.status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => update({ status: tab.value })}
              className={cn(
                'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-200',
              )}
            >
              {tab.label}
              {count !== null ? (
                <span
                  className={cn('ml-1.5 text-xs', active ? 'text-slate-300' : 'text-slate-400')}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchInput
          value={values.q}
          onChange={(q) => update({ q })}
          placeholder="Raqam (10254), telefon yoki mijoz ismi"
          className="w-full sm:w-80"
        />
        <label className="text-sm text-slate-600">
          <span className="mb-1 block">Sanadan</span>
          <input
            type="date"
            value={values.from}
            onChange={(e) => update({ from: e.target.value })}
            className={inputClass(false, 'h-10 text-sm')}
          />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-1 block">Sanagacha</span>
          <input
            type="date"
            value={values.to}
            onChange={(e) => update({ to: e.target.value })}
            className={inputClass(false, 'h-10 text-sm')}
          />
        </label>
        {values.q || values.from || values.to || values.userId ? (
          <button
            type="button"
            onClick={() => update({ q: '', from: '', to: '', userId: '' })}
            className="h-10 text-sm font-medium text-brand-700 hover:underline"
          >
            Filtrlarni tozalash
          </button>
        ) : null}
      </div>

      {query.isPending ? (
        <TableSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : query.data.items.length === 0 ? (
        <EmptyState title="Buyurtma topilmadi" />
      ) : (
        <>
          <div className={cn('card overflow-x-auto', query.isFetching && 'opacity-70')}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Raqam</th>
                  <th>Sana</th>
                  <th>Mijoz</th>
                  <th>Yetkazish</th>
                  <th>To‘lov</th>
                  <th className="text-right">Summa</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/orders/${order.number}`)}
                  >
                    <td className="tabular whitespace-nowrap font-semibold text-brand-700">
                      <a href={`/orders/${order.number}`} onClick={(e) => e.stopPropagation()}>
                        {order.number}
                      </a>
                    </td>
                    <td className="whitespace-nowrap text-slate-600">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td>
                      <p className="font-medium">{order.customerName}</p>
                      <p className="tabular whitespace-nowrap text-xs text-slate-500">
                        {formatUzPhone(order.customerPhone)}
                      </p>
                    </td>
                    <td className="text-slate-600">
                      {DELIVERY_METHOD_LABELS[order.deliveryMethod]}
                      {order.region ? (
                        <span className="block text-xs text-slate-500">{order.region}</span>
                      ) : null}
                    </td>
                    <td className="text-slate-600">
                      {PAYMENT_METHOD_LABELS[order.paymentMethod]}
                      <span
                        className={cn(
                          'block text-xs',
                          order.paymentStatus === 'PAID' ? 'text-success' : 'text-slate-500',
                        )}
                      >
                        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </span>
                    </td>
                    <td className="tabular whitespace-nowrap text-right font-semibold">
                      {formatSom(order.total)}
                      <span className="block text-xs font-normal text-slate-500">
                        {order.itemsCount} dona
                      </span>
                    </td>
                    <td>
                      <OrderStatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            total={query.data.total}
            onPage={(page) => update({ page: String(page) })}
          />
        </>
      )}
    </div>
  );
}
