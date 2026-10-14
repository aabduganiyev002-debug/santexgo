'use client';

import type { ProductDetail } from '@santexgo/shared';
import { ShoppingCart, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@santexgo/ui/button';
import { unitLabel } from '@santexgo/ui/format';
import { useCart } from '@/lib/stores/cart';
import { toast } from '@santexgo/ui/toast';
import { FavoriteButton } from './favorite-button';
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
      <div className="flex items-start gap-3">
        <div className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Hozircha sotuvda yo‘q. Telefon orqali buyurtma bering — keltirib berish muddatini aytamiz.
        </div>
        <FavoriteButton productId={product.id} productName={product.name} variant="outline" />
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
      <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]">
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
        <FavoriteButton
          productId={product.id}
          productName={product.name}
          variant="outline"
          className="sm:order-last"
        />
        <Button
          size="lg"
          variant="outline"
          className="col-span-2 sm:col-span-1"
          onClick={() => {
            if (canAdd) add(product, Math.min(quantity, max));
            router.push('/checkout');
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
