'use client';

import type { FavoriteIds } from '@santexgo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api/client';
import { errorMessage } from './api/errors';
import { useMe } from './auth';
import { toast } from './stores/toast';

export const FAVORITE_IDS_KEY = ['account', 'favorites', 'ids'] as const;

/** Sevimli mahsulotlar ID'lari (yurakchalar uchun). Kirmagan foydalanuvchida — bo'sh. */
export function useFavoriteIds(): ReadonlySet<string> {
  const { user } = useMe();
  const query = useQuery({
    queryKey: FAVORITE_IDS_KEY,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    queryFn: () => api<FavoriteIds>('/favorites/ids'),
    select: (data) => new Set(data.productIds),
  });
  return (user && query.data) || EMPTY;
}

const EMPTY: ReadonlySet<string> = new Set();

/** Yurakchani bosish: darhol belgilanadi, xato bo'lsa qaytariladi. */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, favorite }: { productId: string; favorite: boolean }) =>
      api(`/favorites/${productId}`, { method: favorite ? 'PUT' : 'DELETE' }),
    onMutate: async ({ productId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: FAVORITE_IDS_KEY });
      const previous = queryClient.getQueryData<FavoriteIds>(FAVORITE_IDS_KEY);
      queryClient.setQueryData<FavoriteIds>(FAVORITE_IDS_KEY, (data) => {
        const ids = (data?.productIds ?? []).filter((id) => id !== productId);
        return { productIds: favorite ? [productId, ...ids] : ids };
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      queryClient.setQueryData(FAVORITE_IDS_KEY, context?.previous);
      toast.error(errorMessage(error));
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ['account', 'favorites'], refetchType: 'none' }),
  });
}
