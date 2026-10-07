'use client';

import type { AdminOrderListResponse, AdminProductListItem, Paginated } from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { formatDateTime, formatSom } from '@santexgo/ui/format';
import { OrderStatusBadge } from '@santexgo/ui/order-status-badge';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';

/** Bosh sahifa: yangi buyurtmalar va kam qolgan mahsulotlar (statistika — keyingi bosqichda). */
export function Dashboard() {
  const orders = useQuery({
    queryKey: ['admin', 'orders', 'list', 'dashboard'],
    queryFn: () => api<AdminOrderListResponse>('/admin/orders?status=active&pageSize=8'),
    refetchInterval: 60_000,
  });
  const lowStock = useQuery({
    queryKey: ['admin', 'products', 'low-stock'],
    queryFn: () =>
      api<Paginated<AdminProductListItem>>(
        '/admin/products?status=active&stock=low&sort=stock_asc&pageSize=8',
      ),
  });

  return (
    <div>
      <PageHeader title="Bosh sahifa" />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <ShoppingBag className="h-4 w-4 text-brand-600" aria-hidden="true" />
              Faol buyurtmalar
            </h2>
            <Link href="/orders?status=active" className="text-sm text-brand-700 hover:underline">
              Barchasi
            </Link>
          </div>
          {orders.data?.items.length === 0 ? (
            <p className="text-sm text-slate-500">Faol buyurtma yo‘q</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {orders.data?.items.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/orders/${order.number}`}
                    className="flex items-center gap-3 py-2.5 text-sm hover:text-brand-700"
                  >
                    <span className="tabular w-28 font-semibold">{order.number}</span>
                    <span className="min-w-0 flex-1 truncate">{order.customerName}</span>
                    <span className="hidden text-xs text-slate-500 sm:inline">
                      {formatDateTime(order.createdAt)}
                    </span>
                    <span className="tabular font-medium">{formatSom(order.total)}</span>
                    <OrderStatusBadge status={order.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
              Kam qolgan mahsulotlar
            </h2>
            <Link href="/products?stock=low" className="text-sm text-brand-700 hover:underline">
              Barchasi
            </Link>
          </div>
          {lowStock.data?.items.length === 0 ? (
            <p className="text-sm text-slate-500">Barcha mahsulotlar yetarli</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStock.data?.items.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.id}`}
                    className="flex items-center gap-3 py-2.5 text-sm hover:text-brand-700"
                  >
                    <span className="min-w-0 flex-1 truncate">{product.name}</span>
                    <span className="text-xs text-slate-500">{product.sku}</span>
                    <span className="tabular w-16 text-right font-semibold text-warning">
                      {product.availableStock}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
