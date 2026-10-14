import type { CollectionSummary } from '@santexgo/shared';
import Link from 'next/link';
import { collectionHref } from '@/lib/catalog-url';

/**
 * "MATERIAL BO'YICHA" — gorizontal tugmalar (PPR TRUBA, PVC TRUBA, PP TRUBA...).
 * Telefonda barmoq bilan suriladi.
 */
export function CollectionStrip({
  title,
  collections,
}: {
  title: string;
  collections: CollectionSummary[];
}) {
  if (collections.length === 0) return null;
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      <ul className="scroll-row -mx-4 px-4 sm:mx-0 sm:px-0">
        {collections.map((collection) => (
          <li key={collection.slug} className="shrink-0">
            <Link
              href={collectionHref(collection.filter)}
              className="group flex h-full min-w-36 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[var(--shadow-card)] transition-colors hover:border-brand-500 sm:min-w-44"
            >
              {collection.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={collection.imageUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-extrabold text-brand-700">
                  {collection.title.slice(0, 3)}
                </span>
              )}
              <span>
                <span className="block whitespace-nowrap text-sm font-bold uppercase tracking-wide text-slate-900 group-hover:text-brand-700">
                  {collection.title}
                </span>
                <span className="text-xs text-slate-500">
                  {collection.productCount} ta mahsulot
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
