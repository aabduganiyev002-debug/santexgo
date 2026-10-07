'use client';

import { Heart, ShoppingCart, User } from 'lucide-react';
import Link from 'next/link';
import { useMe } from '@santexgo/ui/auth';
import { useFavoriteIds } from '@/lib/favorites';
import { cartCount, useCart } from '@/lib/stores/cart';
import { useIsClient } from '@santexgo/ui/use-is-client';

function useCartCount(): number | null {
  const lines = useCart((state) => state.lines);
  // Savatcha brauzerda saqlanadi — server render bilan farq bo'lmasligi uchun faqat brauzerda
  return useIsClient() ? cartCount(lines) : null;
}

export function CartCountBadge({ className }: { className?: string }) {
  const count = useCartCount();
  if (!count) return null;
  return (
    <span
      className={
        className ??
        'absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sale px-1 text-[11px] font-bold text-white'
      }
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Sarlavhadagi "Kabinet/Kirish", "Sevimlilar" va "Savatcha" tugmalari. */
export function HeaderActions() {
  const { user } = useMe();
  const favorites = useFavoriteIds().size;
  return (
    <div className="flex items-center gap-1">
      <Link
        href="/favorites"
        className="relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        aria-label="Sevimlilar"
      >
        <span className="relative">
          <Heart className="h-5 w-5" aria-hidden="true" />
          {favorites > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
              {favorites > 99 ? '99+' : favorites}
            </span>
          ) : null}
        </span>
        <span className="hidden xl:inline">Sevimlilar</span>
      </Link>
      <Link
        href={user ? '/account' : '/login'}
        className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 lg:inline-flex"
      >
        <User className="h-5 w-5" aria-hidden="true" />
        <span className="max-w-32 truncate">{user ? user.firstName : 'Kirish'}</span>
      </Link>
      <Link
        href="/cart"
        className="relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        aria-label="Savatcha"
      >
        <span className="relative">
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          <CartCountBadge />
        </span>
        <span className="hidden lg:inline">Savatcha</span>
      </Link>
    </div>
  );
}
