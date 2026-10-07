'use client';

import type { AccountOverview } from '@santexgo/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Heart, MapPin, Package, Wallet } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { OrderCard } from '@/components/orders/order-card';
import { Alert } from '@/components/ui/alert';
import { buttonClass } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { formatDate, formatSom } from '@/lib/format';

export const OVERVIEW_KEY = ['account', 'overview'] as const;

/** Kabinet bosh sahifasi: hisob, hozirgi buyurtmalar, tezkor havolalar. */
export function AccountOverviewView() {
  const query = useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: () => api<AccountOverview>('/account/overview'),
  });

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (query.error) return <Alert tone="error">{errorMessage(query.error)}</Alert>;

  const { user, stats, activeOrders, favoritesCount, addresses } = query.data;
  const defaultAddress = addresses.find((a) => a.isDefault);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Assalomu alaykum, {user.firstName}!
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          SantexGo mijozi: {formatDate(user.createdAt)} dan beri
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<Package className="h-5 w-5" />}
          label="Jami buyurtmalar"
          value={String(stats.ordersCount)}
          href="/account/orders"
        />
        <Stat
          icon={<Package className="h-5 w-5" />}
          label="Hozirgi buyurtmalar"
          value={String(stats.activeOrdersCount)}
          href="/account/orders?status=active"
        />
        <Stat
          icon={<Wallet className="h-5 w-5" />}
          label="Jami xarid summasi"
          value={formatSom(stats.totalSpent)}
          hint={`${stats.deliveredCount} ta yetkazilgan buyurtma`}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Hozirgi buyurtmalar</h2>
          <Link
            href="/account/orders"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Barchasi
          </Link>
        </div>
        {activeOrders.length > 0 ? (
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <div className="card flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-slate-600">Hozircha faol buyurtma yo‘q.</p>
            <Link href="/catalog" className={buttonClass('primary')}>
              Xarid qilish
            </Link>
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLink
          href="/favorites"
          icon={<Heart className="h-5 w-5" />}
          title="Sevimlilar"
          text={favoritesCount > 0 ? `${favoritesCount} ta mahsulot` : 'Hali mahsulot yo‘q'}
        />
        <QuickLink
          href="/account/addresses"
          icon={<MapPin className="h-5 w-5" />}
          title="Manzillar"
          text={
            defaultAddress
              ? [defaultAddress.district, defaultAddress.street].join(', ')
              : 'Yetkazib berish manzilini qo‘shing'
          }
        />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-slate-500">{label}</span>
        <span className="tabular block truncate text-xl font-extrabold">{value}</span>
        {hint ? <span className="block text-xs text-slate-500">{hint}</span> : null}
      </span>
    </>
  );
  const className = 'card flex items-center gap-3 p-4';
  return href ? (
    <Link href={href} className={`${className} transition-shadow hover:shadow-[var(--shadow-pop)]`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="card group flex items-center gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-pop)]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-sm text-slate-500">{text}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
