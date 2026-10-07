'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { type CatalogParams, toQueryString } from '@/lib/catalog-url';

/**
 * Filtr o'zgarganda URL yangilanadi (havolani ulashish mumkin), sahifa yuqoriga sakramaydi.
 * Tanlov ekranda darhol ko'rinadi (optimistik), natijalar server javobi bilan yangilanadi.
 */
export function useCatalogNavigation(params: CatalogParams = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(params);
  return {
    pending,
    params: optimistic,
    navigate: (next: CatalogParams, path: string = pathname) =>
      startTransition(() => {
        setOptimistic(next);
        router.push(`${path}${toQueryString(next)}`, { scroll: false });
      }),
  };
}
