'use client';

import type { OrderSummaryView, Paginated } from '@santexgo/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { OrderCard } from '@/components/orders/order-card';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClass } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { cn } from '@/lib/cn';

const TABS = [
  { value: 'all', label: 'Barchasi' },
  { value: 'active', label: 'Hozirgi' },
  { value: 'completed', label: 'Yakunlangan' },
] as const;
type Tab = (typeof TABS)[number]['value'];

/** Buyurtmalar tarixi: hozirgi va yakunlangan buyurtmalar, yangilari birinchi. */
export function MyOrders() {
  const params = useSearchParams();
  const raw = params.get('status');
  const status: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : 'all';

  const query = useInfiniteQuery({
    queryKey: ['account', 'orders', 'list', status],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Paginated<OrderSummaryView>>(`/orders?status=${status}&page=${pageParam}&pageSize=10`),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
  const orders = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Buyurtmalarim</h1>
      <div role="tablist" aria-label="Buyurtmalar holati" className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            role="tab"
            aria-selected={status === tab.value}
            href={tab.value === 'all' ? '/account/orders' : `/account/orders?status=${tab.value}`}
            replace
            scroll={false}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors',
              status === tab.value
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 shadow-[var(--shadow-card)] hover:bg-slate-100',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {query.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : query.error ? (
        <Alert tone="error">{errorMessage(query.error)}</Alert>
      ) : orders.length === 0 ? (
        <div className="card flex flex-col items-center p-10 text-center">
          <Package className="h-12 w-12 text-slate-300" aria-hidden="true" />
          <p className="mt-3 font-semibold">
            {status === 'all' ? 'Siz hali buyurtma bermagansiz' : 'Bu bo‘limda buyurtma yo‘q'}
          </p>
          <Link href="/catalog" className={buttonClass('primary', 'md', 'mt-5')}>
            Katalogga o‘tish
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
          {query.hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                loading={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                Ko‘proq ko‘rsatish
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
