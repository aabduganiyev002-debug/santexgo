'use client';

import { Heart } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useMe } from '@santexgo/ui/auth';
import { cn } from '@santexgo/ui/cn';
import { useFavoriteIds, useToggleFavorite } from '@/lib/favorites';
import { toast } from '@santexgo/ui/toast';

/** Yurakcha: sevimlilarga qo'shish/olib tashlash. Kirmagan bo'lsa — kirish sahifasiga. */
export function FavoriteButton({
  productId,
  productName,
  variant = 'overlay',
  className,
}: {
  productId: string;
  productName: string;
  variant?: 'overlay' | 'outline';
  className?: string;
}) {
  const { user } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const favorite = useFavoriteIds().has(productId);
  const toggle = useToggleFavorite();

  return (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={
        favorite ? `${productName} — sevimlilardan olib tashlash` : `${productName} — sevimlilarga`
      }
      title={favorite ? 'Sevimlilarda' : 'Sevimlilarga qo‘shish'}
      onClick={() => {
        if (!user) {
          toast.info('Sevimlilarga qo‘shish uchun tizimga kiring');
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        toggle.mutate({ productId, favorite: !favorite });
      }}
      className={cn(
        'inline-flex items-center justify-center transition-colors',
        variant === 'overlay'
          ? 'h-9 w-9 rounded-full bg-white/90 text-slate-500 shadow-sm backdrop-blur hover:text-sale'
          : 'h-12 w-12 rounded-xl border border-slate-300 bg-white text-slate-600 hover:border-sale hover:text-sale',
        favorite && 'text-sale',
        className,
      )}
    >
      <Heart className={cn('h-5 w-5', favorite && 'fill-current')} aria-hidden="true" />
    </button>
  );
}
