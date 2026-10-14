'use client';

import type { AdminOrderListResponse } from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { useLogout, useMe } from '@santexgo/ui/auth';
import { Button, buttonClass, Spinner } from '@santexgo/ui/button';
import { cn } from '@santexgo/ui/cn';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, LogOut, Menu, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { SITE_URL } from '@/lib/config';
import { NAV_SECTIONS } from './nav';

/** Yangi (qabul qilingan, hali tasdiqlanmagan) buyurtmalar soni — har daqiqada yangilanadi. */
function useNewOrdersCount(enabled: boolean): number {
  const query = useQuery({
    queryKey: ['admin', 'orders', 'new-count'],
    enabled,
    refetchInterval: 60_000,
    queryFn: () => api<AdminOrderListResponse>('/admin/orders?status=RECEIVED&pageSize=1'),
  });
  return query.data?.statusCounts.RECEIVED ?? 0;
}

/** Admin panel qobig'i: chap menyu (telefonda — ochiladigan), yuqori panel, kirish tekshiruvi. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useMe();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  // Boshqa sahifaga o'tilganda telefondagi menyu yopiladi
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setMenuOpen(false);
  }
  const isAdmin = user?.role === 'ADMIN';
  const newOrders = useNewOrdersCount(isAdmin);

  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isLoading, user, pathname, router]);

  const onLogout = async () => {
    await logout();
    router.replace('/login');
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="h-8 w-8 text-brand-600" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldAlert className="h-12 w-12 text-sale" aria-hidden="true" />
        <h1 className="text-xl font-bold">Admin panelga kirish huquqi yo‘q</h1>
        <p className="max-w-sm text-slate-600">
          {user.firstName}, siz mijoz akkaunti bilan kirgansiz. Admin akkaunti bilan qayta kiring.
        </p>
        <Button onClick={() => void onLogout()}>Boshqa akkaunt bilan kirish</Button>
      </div>
    );
  }

  const sidebar = (
    <nav aria-label="Admin menyu" className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-5 text-white">
        <ShieldCheck className="h-6 w-6 text-brand-400" aria-hidden="true" />
        <span className="text-lg font-bold">SantexGo Admin</span>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title ?? 'main'}>
            {section.title ? (
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {section.title}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  'exact' in item && item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const badge = 'badge' in item && item.badge === 'newOrders' ? newOrders : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-brand-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                      {badge > 0 ? (
                        <span
                          className="rounded-full bg-sale px-1.5 py-0.5 text-[11px] font-bold leading-none text-white"
                          title="Yangi buyurtmalar"
                        >
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-800 p-3">
        <a
          href={SITE_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Saytni ochish
        </a>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-slate-900 lg:block">
        {sidebar}
      </aside>
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Menyuni yopish"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative h-full w-72 max-w-[85vw] bg-slate-900">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
              aria-label="Yopish"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Menyu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex-1" />
        <span className="hidden text-sm text-slate-600 sm:inline">
          {user.firstName} {user.lastName}
        </span>
        <button
          type="button"
          onClick={() => void onLogout()}
          className={buttonClass('ghost', 'sm')}
          title="Chiqish"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Chiqish</span>
        </button>
      </header>
      <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
    </div>
  );
}
