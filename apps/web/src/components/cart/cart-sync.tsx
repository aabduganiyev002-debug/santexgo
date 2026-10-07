'use client';

import type { CartView } from '@santexgo/shared';
import { useEffect } from 'react';
import { api } from '@santexgo/ui/api-client';
import { isApiError } from '@santexgo/ui/api-errors';
import { useMe } from '@santexgo/ui/auth';
import { isServerSyncPaused, useCart, withoutServerSync } from '@/lib/stores/cart';

const PUSH_DELAY_MS = 400;

/**
 * Savatchani akkaunt bilan sinxronlaydi:
 * - kirganda: mehmon savatchasi serverdagisiga qo'shiladi (yoki serverdagisi yuklanadi);
 * - kirgan holatda: har bir o'zgarish serverga yoziladi (telefon va kompyuterda bir xil savatcha);
 * - chiqqanda: savatcha akkauntda qoladi, brauzerdan tozalanadi.
 */
export function CartSync() {
  const { user, isLoading } = useMe();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (isLoading) return;
    const { owner, lines } = useCart.getState();
    if (!userId) {
      if (owner) withoutServerSync(() => useCart.getState().reset());
      return;
    }
    let cancelled = false;
    // Mehmon savatchasi — qo'shiladi; boshqa akkauntniki yoki o'ziniki — serverdagisi olinadi
    const request =
      owner === null && lines.length > 0
        ? api<CartView>('/cart/merge', {
            method: 'POST',
            body: { items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) },
          })
        : api<CartView>('/cart');
    request
      .then((view) => {
        if (!cancelled) withoutServerSync(() => useCart.getState().setFromServer(view, userId));
      })
      .catch(() => undefined); // Server javob bermasa — brauzerdagi savatcha bilan davom etiladi
    return () => {
      cancelled = true;
    };
  }, [userId, isLoading]);

  useEffect(() => {
    if (!userId) return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const pending = new Map<string, number>();

    const push = (productId: string) => {
      const quantity = pending.get(productId);
      pending.delete(productId);
      timers.delete(productId);
      if (quantity === undefined) return;
      const request =
        quantity > 0
          ? api(`/cart/items/${productId}`, { method: 'PUT', body: { quantity } })
          : api(`/cart/items/${productId}`, { method: 'DELETE' });
      request.catch((error: unknown) => {
        // Mahsulot sotuvdan olingan — brauzerdan ham olib tashlanadi
        if (isApiError(error) && error.status === 404) {
          withoutServerSync(() => useCart.getState().remove(productId));
        }
      });
    };

    const unsubscribe = useCart.subscribe((state, prev) => {
      if (isServerSyncPaused() || state.owner !== userId || prev.owner !== userId) return;
      const before = new Map(prev.lines.map((l) => [l.productId, l.quantity]));
      const after = new Map(state.lines.map((l) => [l.productId, l.quantity]));
      const changed: [string, number][] = [];
      for (const [id, quantity] of after)
        if (before.get(id) !== quantity) changed.push([id, quantity]);
      for (const id of before.keys()) if (!after.has(id)) changed.push([id, 0]);
      for (const [id, quantity] of changed) {
        pending.set(id, quantity);
        clearTimeout(timers.get(id));
        timers.set(
          id,
          setTimeout(() => push(id), PUSH_DELAY_MS),
        );
      }
    });

    return () => {
      unsubscribe();
      // Kutib turgan o'zgarishlar darhol yuboriladi
      for (const [id, timer] of timers) {
        clearTimeout(timer);
        push(id);
      }
    };
  }, [userId]);

  return null;
}
