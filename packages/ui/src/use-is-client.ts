'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** Brauzerda render bo'lyaptimi (server render bilan farq qiladigan qiymatlar uchun). */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
