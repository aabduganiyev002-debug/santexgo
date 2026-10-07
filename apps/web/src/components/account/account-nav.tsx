'use client';

import { Heart, LayoutDashboard, LogOut, MapPin, Package, UserCog } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLogout, useMe } from '@/lib/auth';
import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/account', label: 'Umumiy', icon: LayoutDashboard, exact: true },
  { href: '/account/orders', label: 'Buyurtmalarim', icon: Package },
  { href: '/favorites', label: 'Sevimlilar', icon: Heart },
  { href: '/account/addresses', label: 'Manzillar', icon: MapPin },
  { href: '/account/profile', label: 'Profil va xavfsizlik', icon: UserCog },
];

/** Kabinet menyusi: kompyuterda chap ustun, telefonda suriladigan tugmalar qatori. */
export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const { user, isLoading } = useMe();

  // Sessiya tugasa (boshqa qurilmada parol o'zgartirilgan va h.k.) — kirish sahifasiga
  useEffect(() => {
    if (!isLoading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isLoading, user, pathname, router]);

  const onLogout = async () => {
    await logout();
    router.replace('/');
    router.refresh();
  };

  return (
    <nav aria-label="Kabinet menyusi" className="lg:sticky lg:top-24">
      {user ? (
        <div className="mb-4 hidden px-3 lg:block">
          <p className="text-lg font-bold">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-sm text-slate-500">Shaxsiy kabinet</p>
        </div>
      ) : null}
      <ul className="scroll-row -mx-4 px-4 lg:mx-0 lg:block lg:space-y-1 lg:px-0">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-600 text-white lg:bg-brand-50 lg:text-brand-700'
                    : 'bg-white text-slate-700 hover:bg-slate-100 lg:bg-transparent',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => void onLogout()}
            className="flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-sale-soft hover:text-sale lg:bg-transparent"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Chiqish
          </button>
        </li>
      </ul>
    </nav>
  );
}
