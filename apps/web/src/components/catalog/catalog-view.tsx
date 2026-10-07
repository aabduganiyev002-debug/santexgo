import type { ProductListResponse } from '@santexgo/shared';
import { PackageSearch } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { type Crumb, Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ProductGrid } from '@/components/product/product-grid';
import { buttonClass } from '@/components/ui/button';
import { serverGet } from '@/lib/api/server';
import { type CatalogParams, hasActiveFilters, toQueryString } from '@/lib/catalog-url';
import { countLabel } from '@/lib/format';
import { ActiveFilters } from './active-filters';
import { FilterPanel } from './filter-panel';
import { MobileFilters } from './mobile-filters';
import { Pagination } from './pagination';
import { SortSelect } from './sort-select';

export interface CatalogViewProps {
  /** Sahifa manzili (filtrlar shunga query sifatida qo'shiladi) */
  basePath: string;
  /** URL'dagi filtrlar */
  params: CatalogParams;
  /** Sahifaning o'zi belgilagan filtrlar: { category: 'trubalar' } yoki { brand: 'plastherm' } */
  fixed?: CatalogParams;
  title: string;
  breadcrumbs?: Crumb[];
  intro?: ReactNode;
}

/** Katalog sahifalarining umumiy ko'rinishi: filtrlar, natijalar, saralash, sahifalash. */
export async function CatalogView({
  basePath,
  params,
  fixed = {},
  title,
  breadcrumbs,
  intro,
}: CatalogViewProps) {
  const query = { ...params, ...fixed };
  const data = await serverGet<ProductListResponse>(`/catalog/products${toQueryString(query)}`, {
    revalidate: 30,
  });
  const fixedKeys = Object.keys(fixed);

  const categoryLink = {
    mode: basePath.startsWith('/catalog') ? 'path' : 'query',
    basePath,
  } as const;

  const crumbs: Crumb[] =
    breadcrumbs ??
    (data.category
      ? [
          { href: '/catalog', label: 'Katalog' },
          ...data.category.breadcrumbs.map((c) => ({ href: `/catalog/${c.slug}`, label: c.name })),
        ]
      : [{ href: '/catalog', label: 'Katalog' }]);

  const activeCount = Object.keys(params).filter(
    (k) => !['sort', 'page', 'q', 'pageSize', ...fixedKeys].includes(k),
  ).length;
  const panel = { facets: data.facets, params, fixed: fixedKeys, categoryLink };

  return (
    <div className="container-page space-y-4 py-4 sm:py-6">
      <Breadcrumbs items={crumbs} />

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{countLabel(data.total)}</p>
        </div>
      </div>
      {intro}

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
        <aside className="hidden lg:block" aria-label="Filtrlar">
          <div className="card sticky top-[140px] max-h-[calc(100dvh-160px)] overflow-y-auto p-4">
            <FilterPanel {...panel} />
          </div>
        </aside>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <MobileFilters {...panel} total={data.total} activeCount={activeCount} />
            <div className="ml-auto">
              <SortSelect params={params} hasQuery={Boolean(params.q)} />
            </div>
          </div>
          <ActiveFilters facets={data.facets} params={params} fixed={fixedKeys} />

          {data.items.length > 0 ? (
            <>
              <ProductGrid products={data.items} />
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                basePath={basePath}
                params={params}
              />
            </>
          ) : (
            <EmptyResults
              filtered={hasActiveFilters(params) || Boolean(params.q)}
              basePath={basePath}
              params={params}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyResults({
  filtered,
  basePath,
  params,
}: {
  filtered: boolean;
  basePath: string;
  params: CatalogParams;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <PackageSearch className="h-12 w-12 text-slate-300" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-bold">Mahsulot topilmadi</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-500">
        {filtered
          ? 'Tanlangan filtrlarga mos mahsulot yo‘q. Filtrlarni kamaytirib ko‘ring.'
          : 'Bu bo‘limda hozircha mahsulot yo‘q.'}
      </p>
      {filtered ? (
        <Link
          href={`${basePath}${toQueryString({ q: params.q })}`}
          className={buttonClass('outline', 'md', 'mt-6')}
        >
          Filtrlarni tozalash
        </Link>
      ) : (
        <Link href="/catalog" className={buttonClass('outline', 'md', 'mt-6')}>
          Butun katalog
        </Link>
      )}
    </div>
  );
}
