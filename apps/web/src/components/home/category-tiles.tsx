import type { CategoryNode } from '@santexgo/shared';
import Link from 'next/link';

/** Kategoriyalar plitkalari (subkategoriyalari bilan). */
export function CategoryTiles({ categories }: { categories: CategoryNode[] }) {
  if (categories.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {categories.map((category) => (
        <li key={category.slug}>
          <Link
            href={`/catalog/${category.slug}`}
            className="card group flex h-full flex-col gap-2 p-4 transition-shadow hover:shadow-[var(--shadow-pop)]"
          >
            {category.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={category.imageUrl}
                alt=""
                className="h-20 w-full object-contain"
                loading="lazy"
              />
            ) : null}
            <span className="font-bold text-slate-900 group-hover:text-brand-700">
              {category.name}
            </span>
            {category.children.length > 0 ? (
              <span className="line-clamp-2 text-xs leading-5 text-slate-500">
                {category.children.map((c) => c.name).join(' · ')}
              </span>
            ) : null}
            <span className="mt-auto text-xs font-medium text-slate-400">
              {category.productCount} ta mahsulot
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
