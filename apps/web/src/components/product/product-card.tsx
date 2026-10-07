import type { ProductCard as ProductCardData } from '@santexgo/shared';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { AddToCartButton } from './add-to-cart-button';
import { Price } from './price';
import { ProductImage } from './product-image';
import { StockLabel } from './stock-label';

/** Ro'yxatdagi mahsulot kartochkasi: rasm asosiy fokusda, narx va mavjudlik aniq ko'rinadi. */
export function ProductCard({
  product,
  priority,
  className,
}: {
  product: ProductCardData;
  priority?: boolean;
  className?: string;
}) {
  const href = `/products/${product.slug}`;
  return (
    <article
      className={cn(
        'card group relative flex h-full flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-pop)]',
        !product.stock.inStock && 'opacity-80',
        className,
      )}
    >
      <Link
        href={href}
        className="relative block aspect-square bg-white p-3"
        tabIndex={-1}
        aria-hidden="true"
      >
        <ProductImage
          image={product.image}
          alt={product.name}
          priority={priority}
          sizes="(min-width: 1280px) 240px, (min-width: 768px) 30vw, 50vw"
          className="transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          {product.price.discountPercent > 0 ? (
            <Badge tone="sale">−{product.price.discountPercent}%</Badge>
          ) : null}
          {product.isNew ? <Badge tone="new">Yangi</Badge> : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 border-t border-slate-100 p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {product.brand.name}
        </span>
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5 text-slate-800">
          <Link
            href={href}
            className="after:absolute after:inset-0 hover:text-brand-700 focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto space-y-2">
          <Price price={product.price} unit={product.unit} />
          <StockLabel stock={product.stock} unit={product.unit} className="text-xs" />
          {/* Tugma butun kartochka havolasi ustida turishi uchun */}
          <div className="relative z-10">
            <AddToCartButton product={product} compact />
          </div>
        </div>
      </div>
    </article>
  );
}
