'use client';

import type { CartLineView, CartView, ProductCard, ProductUnit } from '@santexgo/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CartLine {
  productId: string;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  thumb: string | null;
  unit: ProductUnit;
  /** Oxirgi ma'lum narx (ko'rsatish uchun; yakuniy narxni server hisoblaydi) */
  price: number;
  basePrice: number;
  quantity: number;
  minOrderQty: number;
  /** Sotuvdagi qoldiq (oxirgi ma'lum) */
  available: number;
}

interface CartState {
  lines: CartLine[];
  /**
   * Savatcha kimniki: null — mehmon (brauzerda), aks holda foydalanuvchi ID.
   * Kirgandan keyin har bir o'zgarish serverga ham yoziladi (cart-sync.tsx).
   */
  owner: string | null;
  add: (product: ProductCard, quantity?: number) => CartLine;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  /** Server hisoblagan savatcha: narx va qoldiqni yangilaydi, sotuvdan olinganlarni olib tashlaydi */
  applyView: (view: CartView) => void;
  /** Serverdagi savatchani to'liq o'rnatadi (kirganda) */
  setFromServer: (view: CartView, owner: string) => void;
  /** Chiqqanda: savatcha akkauntda qoladi, brauzerdan o'chiriladi */
  reset: () => void;
}

function clampQuantity(
  quantity: number,
  line: Pick<CartLine, 'minOrderQty' | 'available'>,
): number {
  const max = Math.max(line.minOrderQty, line.available);
  return Math.min(Math.max(Math.round(quantity), line.minOrderQty), max);
}

export function lineFromView(view: CartLineView): CartLine {
  return {
    productId: view.productId,
    slug: view.slug,
    sku: view.sku,
    name: view.name,
    brand: view.brand.name,
    thumb: view.image?.thumb ?? null,
    unit: view.unit,
    price: view.price.current,
    basePrice: view.price.base,
    quantity: view.quantity,
    minOrderQty: view.minOrderQty,
    available: view.stock.available,
  };
}

/**
 * Savatcha brauzerda saqlanadi (kirmagan mijoz uchun ham ishlaydi).
 * Kirgandan keyin server bilan sinxronlanadi; buyurtmada narx va qoldiq serverda qayta tekshiriladi.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      owner: null,
      add: (product, quantity = product.minOrderQty) => {
        const existing = get().lines.find((l) => l.productId === product.id);
        const base: Omit<CartLine, 'quantity'> = {
          productId: product.id,
          slug: product.slug,
          sku: product.sku,
          name: product.name,
          brand: product.brand.name,
          thumb: product.image?.thumb ?? null,
          unit: product.unit,
          price: product.price.current,
          basePrice: product.price.base,
          minOrderQty: product.minOrderQty,
          available: product.stock.available,
        };
        const line: CartLine = {
          ...base,
          quantity: clampQuantity((existing?.quantity ?? 0) + quantity, base),
        };
        set((state) => ({
          lines: existing
            ? state.lines.map((l) => (l.productId === product.id ? line : l))
            : [...state.lines, line],
        }));
        return line;
      },
      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.productId === productId ? { ...l, quantity: clampQuantity(quantity, l) } : l,
          ),
        })),
      remove: (productId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.productId !== productId) })),
      clear: () => set({ lines: [] }),
      applyView: (view) =>
        set((state) => {
          const fresh = new Map(view.lines.map((line) => [line.productId, line]));
          const gone = new Set(view.unavailableProductIds);
          let changed = false;
          const lines = state.lines.flatMap((line) => {
            if (gone.has(line.productId)) {
              changed = true;
              return [];
            }
            const server = fresh.get(line.productId);
            if (!server) return [line];
            const next = { ...lineFromView(server), quantity: line.quantity };
            if (
              next.price !== line.price ||
              next.basePrice !== line.basePrice ||
              next.available !== line.available ||
              next.name !== line.name ||
              next.thumb !== line.thumb ||
              next.minOrderQty !== line.minOrderQty
            ) {
              changed = true;
              return [next];
            }
            return [line];
          });
          return changed ? { lines } : state;
        }),
      setFromServer: (view, owner) => set({ lines: view.lines.map(lineFromView), owner }),
      reset: () => set({ lines: [], owner: null }),
    }),
    {
      name: 'santexgo-cart',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines, owner: state.owner }),
      // 1-versiyada egasi saqlanmagan — mehmon savatchasi deb hisoblanadi
      migrate: (persisted) => ({ owner: null, ...(persisted as { lines: CartLine[] }) }),
    },
  ),
);

let serverSyncPaused = 0;

/** Serverdan kelgan o'zgarishni qayta serverga yubormaslik uchun (cart-sync.tsx). */
export function withoutServerSync(apply: () => void): void {
  serverSyncPaused += 1;
  try {
    apply();
  } finally {
    serverSyncPaused -= 1;
  }
}

export function isServerSyncPaused(): boolean {
  return serverSyncPaused > 0;
}

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
