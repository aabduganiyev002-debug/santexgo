'use client';

import type { ProductDetail } from '@santexgo/shared';
import { ShoppingCart, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { unitLabel } from '@/lib/format';
import { useCart } from '@/lib/stores/cart';
import { toast } from '@/lib/stores/toast';
import { QuantityStepper } from './quantity-stepper';

/** Miqdor, "Savatchaga qo'shish" va "Hozir sotib olish". */
export function ProductPurchase({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const add = useCart((state) => state.add);
  const inCartQuantity = useCart(
    (state) => state.lines.find((l) => l.productId === product.id)?.quantity ?? 0,
  );
  const min = product.minOrderQty;
  const max = Math.max(min, product.stock.available - inCartQuantity);
  const [quantity, setQuantity] = useState(min);

  if (!product.stock.inStock) {
    return (
      <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
        Hozircha sotuvda yo‘q. Telefon orqali buyurtma bering — keltirib berish muddatini aytamiz.
      </div>
    );
  }

  const canAdd = product.stock.available - inCartQuantity >= min;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper
          value={Math.min(quantity, max)}
          min={min}
          max={max}
          onChange={setQuantity}
        />
        <span className="text-sm text-slate-500">
          {unitLabel(product.unit)}
          {min > 1 ? ` · kamida ${min}` : ''}
          {inCartQuantity > 0 ? ` · savatchada ${inCartQuantity}` : ''}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          size="lg"
          disabled={!canAdd}
          onClick={() => {
            add(product, Math.min(quantity, max));
            toast.success('Savatchaga qo‘shildi', { label: 'Savatcha', href: '/cart' });
          }}
        >
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          Savatchaga qo‘shish
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            if (canAdd) add(product, Math.min(quantity, max));
            router.push('/cart');
          }}
        >
          <Zap className="h-5 w-5" aria-hidden="true" />
          Hozir sotib olish
        </Button>
      </div>
      {!canAdd ? (
        <p className="text-sm text-warning">Barcha mavjud miqdor savatchangizda.</p>
      ) : null}
    </div>
  );
}
