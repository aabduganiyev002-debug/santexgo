import type { BrandSummary } from '@santexgo/shared';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

/** Mashhur brendlar: logotip yoki nomi bilan kartochkalar. */
export function BrandStrip({
  title,
  brands,
  showAllLink = true,
}: {
  title: string;
  brands: BrandSummary[];
  showAllLink?: boolean;
}) {
  if (brands.length === 0) return null;
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-end justify-between">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        {showAllLink ? (
          <Link
            href="/brands"
            className="inline-flex items-center text-sm font-semibold text-brand-700 hover:underline"
          >
            Barcha brendlar
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      <ul className="scroll-row -mx-4 px-4 sm:mx-0 sm:px-0">
        {brands.map((brand) => (
          <li key={brand.slug} className="w-40 shrink-0 sm:w-48">
            <BrandCard brand={brand} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BrandCard({ brand }: { brand: BrandSummary }) {
  return (
    <Link
      href={`/brands/${brand.slug}`}
      className="card flex h-28 flex-col items-center justify-center gap-2 p-4 text-center transition-shadow hover:shadow-[var(--shadow-pop)]"
    >
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logoUrl}
          alt={brand.name}
          className="h-12 w-full object-contain"
          loading="lazy"
        />
      ) : (
        <span className="text-lg font-extrabold uppercase tracking-wider text-slate-800">
          {brand.name}
        </span>
      )}
      <span className="text-xs text-slate-500">{brand.productCount} ta mahsulot</span>
    </Link>
  );
}
