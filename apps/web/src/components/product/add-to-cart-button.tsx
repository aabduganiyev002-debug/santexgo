'use client';

import type { ProductCard } from '@santexgo/shared';
import { Check, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@santexgo/ui/button';
import { useCart } from '@/lib/stores/cart';
import { toast } from '@santexgo/ui/toast';

/** Kartochkadagi "Savatchaga" tugmasi (eng kam buyurtma miqdori bilan qo'shadi). */
export function AddToCartButton({ product, compact }: { product: ProductCard; compact?: boolean }) {
  const add = useCart((state) => state.add);
  const inCart = useCart((state) => state.lines.some((l) => l.productId === product.id));
  const [justAdded, setJustAdded] = useState(false);

  if (!product.stock.inStock) {
    return (
      <Button variant="outline" size={compact ? 'sm' : 'md'} disabled fullWidth>
        Sotuvda yo‘q
      </Button>
    );
  }

  return (
    <Button
      variant={inCart ? 'secondary' : 'primary'}
      size={compact ? 'sm' : 'md'}
      fullWidth
      aria-label={`${product.name} — savatchaga qo‘shish`}
      onClick={() => {
        add(product);
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1500);
        toast.success('Savatchaga qo‘shildi', { label: 'Savatcha', href: '/cart' });
      }}
    >
      {justAdded ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ShoppingCart className="h-4 w-4" aria-hidden="true" />
      )}
      {inCart ? 'Yana qo‘shish' : 'Savatchaga'}
    </Button>
  );
}
