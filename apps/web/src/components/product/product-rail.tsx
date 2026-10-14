import type { ProductCard as ProductCardData } from '@santexgo/shared';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { ProductCard } from './product-card';

/** Bosh sahifadagi gorizontal blok: "Chegirmalar", "Yangi mahsulotlar"... (telefonda suriladi) */
export function ProductRail({
  title,
  href,
  products,
}: {
  title: string;
  href?: string;
  products: ProductCardData[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center text-sm font-semibold text-brand-700 hover:underline"
          >
            Barchasi
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <ul className="scroll-row -mx-4 px-4 sm:mx-0 sm:px-0">
        {products.map((product) => (
          <li key={product.id} className="w-[46%] shrink-0 sm:w-[30%] lg:w-[23.5%] xl:w-[19%]">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
