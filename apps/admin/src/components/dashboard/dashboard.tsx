'use client';

import {
  type AdminOrderListResponse,
  type AdminProductListItem,
  type AdminSalesStats,
  type AdminStatsOverview,
  formatUzPhone,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type Paginated,
  STATS_RANGE_LABELS,
  STATS_RANGES,
  type StatsRange,
} from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { cn } from '@santexgo/ui/cn';
import { formatDateTime, formatSom } from '@santexgo/ui/format';
import { OrderStatusBadge } from '@santexgo/ui/order-status-badge';
import { Skeleton } from '@santexgo/ui/skeleton';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import { BarList } from '@/components/charts/bar-list';
import { SalesChart, SalesTable } from '@/components/charts/sales-chart';
import { percentChange, StatTile } from '@/components/charts/stat-tile';
import { StockMeter } from '@/components/charts/stock-meter';
import { ErrorState } from '@/components/data/states';
import { PageHeader } from '@/components/page-header';
import { useListParams } from '@/lib/use-list-params';

/** Bosh sahifa: bugungi va oylik ko'rsatkichlar, savdo dinamikasi, top ro'yxatlar, ombor. */
export function Dashboard() {
  const { values, update } = useListParams({ range: '30d' });
  const range = (STATS_RANGES as readonly string[]).includes(values.range)
    ? (values.range as StatsRange)
    : '30d';

  const overview = useQuery({
    queryKey: ['admin', 'stats', 'overview'],
    queryFn: () => api<AdminStatsOverview>('/admin/stats/overview'),
    refetchInterval: 60_000,
  });
  const sales = useQuery({
    queryKey: ['admin', 'stats', 'sales', range],
    queryFn: () => api<AdminSalesStats>(`/admin/stats/sales?range=${range}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="viz-root">
      <PageHeader
        title="Bosh sahifa"
        description="Savdo — bekor qilinmagan buyurtmalar summasi (yetkazib berish bilan)"
      />
      <Kpis query={overview} />

      {/* Davr filtri: quyidagi barcha grafik va ro'yxatlarga tegishli */}
      <div role="radiogroup" aria-label="Davr" className="mb-4 mt-6 flex flex-wrap gap-2">
        {STATS_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={range === r}
            onClick={() => update({ range: r })}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              range === r
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-200',
            )}
          >
            {STATS_RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {sales.error ? (
        <ErrorState error={sales.error} />
      ) : !sales.data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className={cn('space-y-4 transition-opacity', sales.isFetching && 'opacity-60')}>
          <div className="grid gap-4 xl:grid-cols-3">
            <SalesCard stats={sales.data} className="xl:col-span-2" />
            <Card title="Buyurtmalar holati" subtitle="Davr ichida berilgan buyurtmalar">
              <BarList
                empty="Bu davrda buyurtma yo‘q"
                items={ORDER_STATUSES.map((status) => ({
                  key: status,
                  label: ORDER_STATUS_LABELS[status],
                  value: sales.data.statuses[status],
                  valueLabel: String(sales.data.statuses[status]),
                  href: `/orders?status=${status}`,
                })).filter((item) => item.value > 0)}
              />
            </Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Eng ko‘p sotilgan mahsulotlar" subtitle="Dona bo‘yicha">
              <BarList
                empty="Bu davrda sotuv yo‘q"
                items={sales.data.topProducts.map((p) => ({
                  key: p.productId,
                  label: p.name,
                  value: p.quantity,
                  valueLabel: `${p.quantity.toLocaleString('ru-RU')} dona`,
                  detail: formatSom(p.revenue),
                  href: `/products/${p.productId}`,
                }))}
              />
            </Card>
            <Card title="Eng ko‘p sotilgan brendlar" subtitle="Savdo summasi bo‘yicha">
              <BarList
                empty="Bu davrda sotuv yo‘q"
                items={sales.data.topBrands.map((b) => ({
                  key: b.brandId,
                  label: b.name,
                  value: b.revenue,
                  valueLabel: formatSom(b.revenue),
                  detail: `${b.quantity.toLocaleString('ru-RU')} dona`,
                  href: `/products?brandId=${b.brandId}`,
                }))}
              />
            </Card>
            <Card title="Eng ko‘p xarid qilgan mijozlar" subtitle="Savdo summasi bo‘yicha">
              {sales.data.topCustomers.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--viz-text-muted)]">
                  Bu davrda xarid yo‘q
                </p>
              ) : (
                <table className="admin-table -mx-1">
                  <tbody>
                    {sales.data.topCustomers.map((c) => (
                      <tr key={c.userId}>
                        <td className="px-1">
                          <Link
                            href={`/customers/${c.userId}`}
                            className="font-medium hover:text-brand-700"
                          >
                            {c.name}
                          </Link>
                          <span className="tabular block text-xs text-slate-500">
                            {formatUzPhone(c.phone)} · {c.orders} ta buyurtma
                          </span>
                        </td>
                        <td className="tabular whitespace-nowrap px-1 text-right font-semibold">
                          {formatSom(c.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ActiveOrders />
        <StockCard overview={overview.data} />
      </div>
    </div>
  );
}

function Kpis({ query }: { query: { data?: AdminStatsOverview; error: unknown } }) {
  if (query.error) return <ErrorState error={query.error} />;
  const o = query.data;
  if (!o) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatTile
        label="Bugungi buyurtmalar"
        value={String(o.today.orders)}
        delta={percentChange(o.today.orders, o.yesterday.orders)}
        deltaLabel={`kecha ${o.yesterday.orders}`}
        href="/orders"
      />
      <StatTile
        label="Bugungi savdo"
        value={formatSom(o.today.revenue)}
        delta={percentChange(o.today.revenue, o.yesterday.revenue)}
        deltaLabel="kechaga nisbatan"
      />
      <StatTile
        label="Shu oy savdosi"
        value={formatSom(o.month.revenue)}
        delta={percentChange(o.month.revenue, o.previousMonth.revenue)}
        deltaLabel="o‘tgan oyning shu kunlariga nisbatan"
      />
      <StatTile
        label="Tasdiqlanmagan buyurtmalar"
        value={String(o.pendingOrders)}
        hint="Operator qo‘ng‘irog‘ini kutmoqda"
        href="/orders?status=active"
      />
      <StatTile
        label="Mijozlar"
        value={o.customers.total.toLocaleString('ru-RU')}
        hint={`Shu oy +${o.customers.newThisMonth} yangi`}
        href="/customers"
      />
    </div>
  );
}

function SalesCard({ stats, className }: { stats: AdminSalesStats; className?: string }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className={cn('card min-w-0 p-4', className)} aria-label="Savdo dinamikasi">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Savdo dinamikasi</h2>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-[var(--viz-text-primary)]">
            {formatSom(stats.totals.revenue)}
          </p>
          <p className="mt-1 text-sm text-[var(--viz-text-secondary)]">
            {stats.totals.orders} ta buyurtma · o‘rtacha {formatSom(stats.totals.averageOrder)} ·{' '}
            {stats.totals.itemsSold.toLocaleString('ru-RU')} dona
            {stats.totals.cancelled > 0 ? ` · ${stats.totals.cancelled} ta bekor qilingan` : ''}
          </p>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm" role="tablist">
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                'rounded-md px-3 py-1 font-medium',
                view === v ? 'bg-white shadow-sm' : 'text-slate-600',
              )}
            >
              {v === 'chart' ? 'Grafik' : 'Jadval'}
            </button>
          ))}
        </div>
      </div>
      {view === 'chart' ? (
        <SalesChart points={stats.series} />
      ) : (
        <SalesTable points={stats.series} />
      )}
    </section>
  );
}

function Card({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="card min-w-0 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle ? <p className="text-xs text-[var(--viz-text-muted)]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActiveOrders() {
  const orders = useQuery({
    queryKey: ['admin', 'orders', 'list', 'dashboard'],
    queryFn: () => api<AdminOrderListResponse>('/admin/orders?status=active&pageSize=8'),
    refetchInterval: 60_000,
  });
  return (
    <Card
      title="Faol buyurtmalar"
      action={
        <Link href="/orders?status=active" className="text-sm text-brand-700 hover:underline">
          Barchasi
        </Link>
      }
    >
      {orders.data?.items.length === 0 ? (
        <p className="text-sm text-slate-500">Faol buyurtma yo‘q</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {orders.data?.items.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.number}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm hover:text-brand-700"
              >
                <span className="tabular w-28 shrink-0 font-semibold">{order.number}</span>
                <span className="min-w-0 flex-1 truncate">{order.customerName}</span>
                <span className="hidden text-xs text-slate-500 md:inline">
                  {formatDateTime(order.createdAt)}
                </span>
                <span className="tabular font-medium">{formatSom(order.total)}</span>
                <OrderStatusBadge status={order.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StockCard({ overview }: { overview: AdminStatsOverview | undefined }) {
  const lowStock = useQuery({
    queryKey: ['admin', 'products', 'low-stock'],
    queryFn: () =>
      api<Paginated<AdminProductListItem>>(
        '/admin/products?status=active&stock=low&sort=stock_asc&pageSize=6',
      ),
  });
  return (
    <Card
      title="Ombor holati"
      subtitle={overview ? `${overview.products.active} ta faol mahsulot` : undefined}
    >
      {overview ? (
        <StockMeter
          inStock={overview.products.inStock}
          lowStock={overview.products.lowStock}
          outOfStock={overview.products.outOfStock}
        />
      ) : (
        <Skeleton className="h-20" />
      )}
      {lowStock.data && lowStock.data.items.length > 0 ? (
        <>
          <p className="mb-1 mt-4 text-sm font-medium">Kam qolganlar</p>
          <ul className="divide-y divide-slate-100">
            {lowStock.data.items.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/products/${product.id}`}
                  className="flex items-center gap-3 py-2 text-sm hover:text-brand-700"
                >
                  <span className="min-w-0 flex-1 truncate">{product.name}</span>
                  <span className="text-xs text-slate-500">{product.sku}</span>
                  <span className="tabular w-16 text-right font-semibold">
                    {product.availableStock} qoldi
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Card>
  );
}
