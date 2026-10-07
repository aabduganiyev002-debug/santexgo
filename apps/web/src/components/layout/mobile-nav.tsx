'use client';

import { Home, LayoutGrid, ShoppingCart, Tag, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMe } from '@santexgo/ui/auth';
import { cn } from '@santexgo/ui/cn';
import { CartCountBadge } from './header-actions';

/** Telefondagi pastki menyu: bosh sahifa, katalog, brendlar, savatcha, kabinet. */
export function MobileNav() {
  const pathname = usePathname();
  const { user } = useMe();
  const items = [
    { href: '/', label: 'Bosh sahifa', icon: Home, match: (p: string) => p === '/' },
    {
      href: '/catalog',
      label: 'Katalog',
      icon: LayoutGrid,
      match: (p: string) => p.startsWith('/catalog') || p === '/search',
    },
    {
      href: '/brands',
      label: 'Brendlar',
      icon: Tag,
      match: (p: string) => p.startsWith('/brands'),
    },
    {
      href: '/cart',
      label: 'Savatcha',
      icon: ShoppingCart,
      match: (p: string) => p.startsWith('/cart') || p.startsWith('/checkout'),
      badge: true,
    },
    {
      href: user ? '/account' : '/login',
      label: user ? 'Kabinet' : 'Kirish',
      icon: User,
      match: (p: string) => p.startsWith('/account') || p === '/login' || p === '/register',
    },
  ];
  return (
    <nav
      aria-label="Pastki menyu"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  active ? 'text-brand-700' : 'text-slate-500',
                )}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" aria-hidden="true" strokeWidth={active ? 2.25 : 1.75} />
                  {item.badge ? <CartCountBadge /> : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
