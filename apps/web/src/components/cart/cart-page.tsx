'use client';

import { CART_ISSUE_LABELS, type CartLineView } from '@santexgo/shared';
import { AlertTriangle, ShoppingBag, ShoppingCart, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Price } from '@/components/product/price';
import { QuantityStepper } from '@/components/product/quantity-stepper';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClass } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/errors';
import { useMe } from '@/lib/auth';
import { useCartView } from '@/lib/cart-view';
import { cn } from '@/lib/cn';
import { formatSom, unitLabel } from '@/lib/format';
import { type CartLine, useCart } from '@/lib/stores/cart';
import { toast } from '@/lib/stores/toast';
import { OrderSummary } from './order-summary';

/** Savatcha: mahsulotlar, miqdor, muammolar (qoldiq yetmasa) va jami summa. */
export function CartPage() {
  const router = useRouter();
  const { user } = useMe();
  const { lines, view, stale, isLoading, error } = useCartView();
  const setQuantity = useCart((state) => state.setQuantity);
  const remove = useCart((state) => state.remove);
  const clear = useCart((state) => state.clear);

  // Sotuvdan olingan mahsulotlar savatchadan olib tashlanadi — bir marta xabar beriladi
  const notified = useRef(new Set<string>());
  useEffect(() => {
    const fresh = (view?.unavailableProductIds ?? []).filter((id) => !notified.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => notified.current.add(id));
    toast.info(`${fresh.length} ta mahsulot sotuvdan olingani uchun savatchadan olib tashlandi`);
  }, [view]);

  if (isLoading && lines.length === 0) return <CartSkeleton />;

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <ShoppingBag className="h-10 w-10" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-xl font-bold">Savatchangiz bo‘sh</h2>
        <p className="mt-2 max-w-sm text-slate-600">
          Katalogdan kerakli mahsulotlarni tanlang — trubalar, fitinglar, kranlar va boshqalar.
        </p>
        <Link href="/catalog" className={buttonClass('primary', 'lg', 'mt-6')}>
          Katalogga o‘tish
        </Link>
      </div>
    );
  }

  const byId = new Map(view?.lines.map((line) => [line.productId, line]));
  const summary = view?.summary;
  const canCheckout = Boolean(view && !view.hasIssues && view.summary.linesCount > 0);
  const checkoutHref = user ? '/checkout' : `/login?next=${encodeURIComponent('/checkout')}`;

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[1fr_360px] lg:items-start lg:pb-0">
      <section aria-label="Savatchadagi mahsulotlar" className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">{lines.length} xil mahsulot</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm('Savatchadagi barcha mahsulotlar o‘chirilsinmi?')) clear();
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Tozalash
          </Button>
        </div>
        {error ? <Alert tone="error">{errorMessage(error)}</Alert> : null}
        <ul className="card divide-y divide-slate-100">
          {lines.map((line) => (
            <CartRow
              key={line.productId}
              line={line}
              server={byId.get(line.productId)}
              onQuantity={(quantity) => setQuantity(line.productId, quantity)}
              onRemove={() => remove(line.productId)}
            />
          ))}
        </ul>
      </section>

      <aside className="space-y-3 lg:sticky lg:top-24">
        {summary ? (
          <OrderSummary summary={summary} stale={stale}>
            {view?.hasIssues ? (
              <Alert tone="error">
                Ayrim mahsulotlar miqdorini tuzating — keyin buyurtma berish mumkin.
              </Alert>
            ) : null}
            <Button
              size="lg"
              fullWidth
              disabled={!canCheckout || stale}
              onClick={() => router.push(checkoutHref)}
              className="hidden lg:inline-flex"
            >
              Rasmiylashtirish
            </Button>
            {!user ? (
              <p className="text-center text-sm text-slate-500">
                Buyurtma berish uchun{' '}
                <Link href={checkoutHref} className="font-medium text-brand-700 hover:underline">
                  tizimga kiring
                </Link>
              </p>
            ) : null}
          </OrderSummary>
        ) : (
          <Skeleton className="h-56 w-full rounded-[var(--radius-card)]" />
        )}
      </aside>

      {/* Telefonda: pastda doim ko'rinadigan jami va tugma */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">Jami</p>
            <p className={cn('tabular truncate text-lg font-extrabold', stale && 'opacity-60')}>
              {summary ? formatSom(summary.total) : '…'}
            </p>
          </div>
          <Button
            size="lg"
            disabled={!canCheckout || stale}
            onClick={() => router.push(checkoutHref)}
          >
            Rasmiylashtirish
          </Button>
        </div>
      </div>
    </div>
  );
}

function CartRow({
  line,
  server,
  onQuantity,
  onRemove,
}: {
  line: CartLine;
  server: CartLineView | undefined;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const issue = server?.quantity === line.quantity ? server.issue : null;
  const outOfStock = issue === 'OUT_OF_STOCK';
  const price = server?.price ?? {
    base: line.basePrice,
    current: line.price,
    discountPercent: 0,
    discountEndsAt: null,
  };
  const max = Math.max(line.minOrderQty, server?.maxQuantity ?? line.available);
  const href = `/products/${line.slug}`;

  return (
    <li className={cn('flex gap-3 p-3 sm:gap-4 sm:p-4', outOfStock && 'bg-slate-50')}>
      <Link
        href={href}
        className={cn(
          'relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white sm:h-24 sm:w-24',
          outOfStock && 'opacity-50',
        )}
      >
        {line.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan WebP rasm
          <img
            src={line.thumb}
            alt=""
            className="h-full w-full object-contain p-1.5"
            loading="lazy"
          />
        ) : (
          <ShoppingCart className="m-auto mt-7 h-6 w-6 text-slate-300" aria-hidden="true" />
        )}
      </Link>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {line.brand}
            </p>
            <Link
              href={href}
              className="line-clamp-2 text-sm font-medium leading-5 text-slate-800 hover:text-brand-700"
            >
              {line.name}
            </Link>
            <p className="text-xs text-slate-400">SKU: {line.sku}</p>
            <Price price={price} unit={line.unit} className="pt-1" />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end">
            {outOfStock ? (
              <span className="text-sm font-semibold uppercase text-slate-500">Sotuvda yo‘q</span>
            ) : (
              <QuantityStepper
                size="sm"
                value={line.quantity}
                min={line.minOrderQty}
                max={max}
                onChange={onQuantity}
                label={`${line.name} — miqdor`}
              />
            )}
            {server && !outOfStock ? (
              <div className="text-right">
                <p className="tabular font-bold">{formatSom(server.lineTotal)}</p>
                {server.lineDiscount > 0 ? (
                  <p className="tabular text-xs text-sale">−{formatSom(server.lineDiscount)}</p>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onRemove}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-sale sm:ml-0"
              aria-label={`${line.name} — savatchadan olib tashlash`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="sm:hidden">O‘chirish</span>
            </button>
          </div>
        </div>
        {issue && server ? <IssueNote line={line} server={server} onQuantity={onQuantity} /> : null}
      </div>
    </li>
  );
}

function IssueNote({
  line,
  server,
  onQuantity,
}: {
  line: CartLine;
  server: CartLineView;
  onQuantity: (quantity: number) => void;
}) {
  const unit = unitLabel(line.unit);
  let text: string = CART_ISSUE_LABELS[server.issue!];
  let fix: { label: string; quantity: number } | null = null;
  if (server.issue === 'OUT_OF_STOCK') text = 'Sotuvda qolmadi — buyurtmaga kirmaydi';
  if (server.issue === 'INSUFFICIENT_STOCK') {
    text = `Omborda faqat ${server.stock.available} ${unit} qoldi`;
    fix = {
      label: `${server.stock.available} ${unit} qoldirish`,
      quantity: server.stock.available,
    };
  }
  if (server.issue === 'BELOW_MIN') {
    text = `Eng kam buyurtma miqdori — ${server.minOrderQty} ${unit}`;
    fix = { label: `${server.minOrderQty} ${unit} qilish`, quantity: server.minOrderQty };
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-warning">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{text}</span>
      {fix ? (
        <button
          type="button"
          onClick={() => onQuantity(fix.quantity)}
          className="font-semibold text-brand-700 underline-offset-2 hover:underline"
        >
          {fix.label}
        </button>
      ) : null}
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="card space-y-4 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-24 w-24" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}
