'use client';

import type { ProductCard, ProductUnit } from '@santexgo/shared';
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
  /** Qo'shilgan paytdagi narx (ko'rsatish uchun; yakuniy narxni server hisoblaydi) */
  price: number;
  basePrice: number;
  quantity: number;
  minOrderQty: number;
  /** Sotuvdagi qoldiq (qo'shilgan paytda) */
  available: number;
}

interface CartState {
  lines: CartLine[];
  add: (product: ProductCard, quantity?: number) => CartLine;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  replace: (lines: CartLine[]) => void;
}

function clampQuantity(
  quantity: number,
  line: Pick<CartLine, 'minOrderQty' | 'available'>,
): number {
  const max = Math.max(line.minOrderQty, line.available);
  return Math.min(Math.max(Math.round(quantity), line.minOrderQty), max);
}

/**
 * Savatcha brauzerda saqlanadi (kirmagan mijoz uchun ham ishlaydi).
 * Kirgandan keyin server bilan sinxronlanadi; buyurtmada narx va qoldiq serverda qayta tekshiriladi.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
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
      replace: (lines) => set({ lines }),
    }),
    {
      name: 'santexgo-cart',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function cartCount(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
