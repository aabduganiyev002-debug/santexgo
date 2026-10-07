'use client';

import type { CartView, DeliveryMethod } from '@santexgo/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@santexgo/ui/api-client';
import { useCart } from './stores/cart';
import { useIsClient } from '@santexgo/ui/use-is-client';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Savatchaning server hisob-kitobi: joriy narxlar, chegirmalar, qoldiq muammolari va
 * yetkazib berish narxi. Brauzerdagi savatcha asosida (mehmon va kirgan mijoz uchun bir xil).
 * Yangi narx va qoldiq brauzerdagi savatchaga ham yoziladi; sotuvdan olinganlari olib tashlanadi.
 */
export function useCartView(deliveryMethod: DeliveryMethod = 'DELIVERY') {
  const lines = useCart((state) => state.lines);
  const mounted = useIsClient();
  const key = useMemo(() => lines.map((l) => `${l.productId}:${l.quantity}`).join(','), [lines]);
  const debouncedKey = useDebounced(key, 300);
  const items = useMemo(
    () =>
      debouncedKey
        ? debouncedKey.split(',').map((pair) => {
            const [productId, quantity] = pair.split(':');
            return { productId: productId!, quantity: Number(quantity) };
          })
        : [],
    [debouncedKey],
  );

  const query = useQuery({
    queryKey: ['cart-view', deliveryMethod, debouncedKey],
    enabled: mounted && items.length > 0,
    queryFn: ({ signal }) =>
      api<CartView>('/cart/preview', {
        method: 'POST',
        body: { items, deliveryMethod },
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const view = items.length > 0 ? query.data : undefined;
  useEffect(() => {
    if (view) useCart.getState().applyView(view);
  }, [view]);

  return {
    lines,
    view,
    /** Ko'rsatilgan hisob savatchadagi miqdorlarga mos emas (yangilanmoqda) */
    stale: key !== debouncedKey || query.isFetching,
    isLoading: !mounted || (items.length > 0 && query.isPending),
    error: query.error,
    refetch: query.refetch,
  };
}
