'use client';

import type { AuthResponse, AuthUser } from '@santexgo/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api, hasSessionHint, onSessionExpired } from './api/client';
import { isApiError } from './api/errors';
import { useIsClient } from './use-is-client';

export const ME_QUERY_KEY = ['auth', 'me'] as const;

/** Joriy foydalanuvchi: kirmagan bo'lsa null. Faqat "kirgan" belgisi bo'lsa API'ga so'rov yuboriladi. */
export function useMe() {
  const mounted = useIsClient();
  const queryClient = useQueryClient();

  useEffect(
    () => onSessionExpired(() => queryClient.setQueryData(ME_QUERY_KEY, null)),
    [queryClient],
  );

  const query = useQuery({
    queryKey: ME_QUERY_KEY,
    enabled: mounted,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AuthUser | null> => {
      if (!hasSessionHint()) return null;
      try {
        return await api<AuthUser>('/auth/me');
      } catch (error) {
        if (isApiError(error) && error.status === 401) return null;
        throw error;
      }
    },
  });
  return { user: query.data ?? null, isLoading: !mounted || query.isLoading };
}

/** Kirish/ro'yxatdan o'tishdan keyin foydalanuvchini keshga yozadi. */
export function useSetSession() {
  const queryClient = useQueryClient();
  return (response: AuthResponse) => queryClient.setQueryData(ME_QUERY_KEY, response.user);
}

export function useLogout() {
  const queryClient = useQueryClient();
  return async () => {
    await api('/auth/logout', { method: 'POST', skipRefresh: true }).catch(() => undefined);
    queryClient.setQueryData(ME_QUERY_KEY, null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] === 'account' });
  };
}

/** Kirgandan keyin qaytish manzili (faqat sayt ichidagi yo'l — boshqa saytga yo'naltirib bo'lmaydi). */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback;
  }
  return next;
}
