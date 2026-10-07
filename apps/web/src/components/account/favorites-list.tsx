'use client';

import type { Paginated, ProductCard } from '@santexgo/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ProductGrid } from '@/components/product/product-grid';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClass } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errors';
import { useMe } from '@/lib/auth';
import { useFavoriteIds } from '@/lib/favorites';

/** Sevimli mahsulotlar. Yurakcha olib tashlansa — ro'yxatdan darhol yo'qoladi. */
export function FavoritesList() {
  const { user, isLoading } = useMe();
  const ids = useFavoriteIds();
  const query = useInfiniteQuery({
    queryKey: ['account', 'favorites', 'list'],
    enabled: Boolean(user),
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api<Paginated<ProductCard>>(`/favorites?page=${pageParam}&pageSize=24`),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  if (!isLoading && !user) {
    return (
      <Empty
        title="Sevimlilarni ko‘rish uchun tizimga kiring"
        text="Yoqqan mahsulotlarni yurakcha bilan belgilang — ular shu yerda saqlanadi."
        action={
          <Link
            href={`/login?next=${encodeURIComponent('/favorites')}`}
            className={buttonClass('primary', 'lg', 'mt-6')}
          >
            Kirish
          </Link>
        }
      />
    );
  }
  if (isLoading || query.isPending) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[3/5] w-full rounded-[var(--radius-card)]" />
        ))}
      </div>
    );
  }
  if (query.error) return <Alert tone="error">{errorMessage(query.error)}</Alert>;

  const products = query.data.pages.flatMap((page) => page.items).filter((p) => ids.has(p.id));
  if (products.length === 0) {
    return (
      <Empty
        title="Sevimlilar ro‘yxati bo‘sh"
        text="Mahsulot kartochkasidagi yurakchani bosing — mahsulot shu yerga qo‘shiladi."
        action={
          <Link href="/catalog" className={buttonClass('primary', 'lg', 'mt-6')}>
            Katalogga o‘tish
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-6">
      <ProductGrid products={products} />
      {query.hasNextPage ? (
        <div className="flex justify-center">
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
  );
}

function Empty({ title, text, action }: { title: string; text: string; action: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sale-soft text-sale">
        <Heart className="h-10 w-10" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-xl font-bold">{title}</h2>
      <p className="mt-2 max-w-sm text-slate-600">{text}</p>
      {action}
    </div>
  );
}
