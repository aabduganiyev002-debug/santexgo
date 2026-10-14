'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Ro'yxat filtrlari URL'da saqlanadi (sahifa yangilansa ham, havola yuborilsa ham saqlanadi).
 * Standart qiymatlar URL'ga yozilmaydi; filtr o'zgarsa sahifa 1 ga qaytadi.
 */
export function useListParams<T extends Record<string, string>>(defaults: T) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = params.toString();

  const values = useMemo(() => {
    const current = new URLSearchParams(query);
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const value = current.get(key as string);
      if (value !== null) result[key] = value as T[keyof T];
    }
    return result;
    // defaults har renderda yangi obyekt — kalitlar o'zgarmaydi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const update = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(query);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === '' || value === defaults[key]) next.delete(key);
        else next.set(key, String(value));
      }
      if (!('page' in patch)) next.delete('page');
      const search = next.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, pathname, router],
  );

  /** API so'rovi uchun: faqat bo'sh bo'lmagan qiymatlar */
  const apiQuery = useMemo(() => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) search.set(key, value);
    return search.toString();
  }, [values]);

  return { values, update, apiQuery };
}
