'use client';

import type { AdminProductListItem, Paginated } from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { Badge } from '@santexgo/ui/badge';
import { buttonClass } from '@santexgo/ui/button';
import { cn } from '@santexgo/ui/cn';
import { inputClass } from '@santexgo/ui/field';
import { formatSom } from '@santexgo/ui/format';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/data/states';
import { PageHeader } from '@/components/page-header';
import { categoryOptionLabel, useBrands, useCategories, useMaterials } from '@/lib/reference-data';
import { useListParams } from '@/lib/use-list-params';

const DEFAULTS = {
  q: '',
  brandId: '',
  categoryId: '',
  materialId: '',
  status: 'all',
  stock: '',
  sort: 'new',
  page: '1',
};

const SORTS = [
  ['new', 'Yangilari'],
  ['name', 'Nomi'],
  ['price_asc', 'Arzonroq'],
  ['price_desc', 'Qimmatroq'],
  ['stock_asc', 'Qoldiq kam'],
  ['stock_desc', 'Qoldiq ko‘p'],
  ['sold', 'Ko‘p sotilgan'],
] as const;

const selectClass = inputClass(false, 'h-10 w-auto text-sm');

export function ProductsList() {
  const router = useRouter();
  const { values, update, apiQuery } = useListParams(DEFAULTS);
  const brands = useBrands();
  const categories = useCategories();
  const materials = useMaterials();
  const query = useQuery({
    queryKey: ['admin', 'products', 'list', apiQuery],
    queryFn: () => api<Paginated<AdminProductListItem>>(`/admin/products?${apiQuery}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Mahsulotlar"
        description="Narx, qoldiq, chegirma va holat — bir joyda"
        actions={
          <Link href="/products/new" className={buttonClass('primary')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Mahsulot qo‘shish
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput
          value={values.q}
          onChange={(q) => update({ q })}
          placeholder="Nomi yoki SKU"
          className="w-full sm:w-72"
        />
        <select
          aria-label="Brend"
          value={values.brandId}
          onChange={(e) => update({ brandId: e.target.value })}
          className={selectClass}
        >
          <option value="">Barcha brendlar</option>
          {brands.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Kategoriya"
          value={values.categoryId}
          onChange={(e) => update({ categoryId: e.target.value })}
          className={selectClass}
        >
          <option value="">Barcha kategoriyalar</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryOptionLabel(c)}
            </option>
          ))}
        </select>
        <select
          aria-label="Material"
          value={values.materialId}
          onChange={(e) => update({ materialId: e.target.value })}
          className={selectClass}
        >
          <option value="">Barcha materiallar</option>
          {materials.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Qoldiq"
          value={values.stock}
          onChange={(e) => update({ stock: e.target.value })}
          className={selectClass}
        >
          <option value="">Qoldiq: barchasi</option>
          <option value="in">Sotuvda bor</option>
          <option value="low">Kam qolgan</option>
          <option value="out">Sotuvda yo‘q</option>
        </select>
        <select
          aria-label="Holat"
          value={values.status}
          onChange={(e) => update({ status: e.target.value })}
          className={selectClass}
        >
          <option value="all">Holat: barchasi</option>
          <option value="active">Faol</option>
          <option value="archived">Arxivda</option>
        </select>
        <select
          aria-label="Saralash"
          value={values.sort}
          onChange={(e) => update({ sort: e.target.value })}
          className={selectClass}
        >
          {SORTS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {query.isPending ? (
        <TableSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : query.data.items.length === 0 ? (
        <EmptyState title="Mahsulot topilmadi" />
      ) : (
        <>
          <div className={cn('card overflow-x-auto', query.isFetching && 'opacity-70')}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mahsulot</th>
                  <th>Brend / kategoriya</th>
                  <th className="text-right">Narx</th>
                  <th className="text-right">Sotuvda</th>
                  <th className="text-right">Band</th>
                  <th className="text-right">Sotilgan</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((product) => (
                  <tr
                    key={product.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/products/${product.id}`)}
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white">
                          {product.thumbUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan WebP rasm
                            <img
                              src={product.thumbUrl}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-slate-300" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/products/${product.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="line-clamp-2 font-medium hover:text-brand-700"
                          >
                            {product.name}
                          </Link>
                          <p className="text-xs text-slate-500">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-slate-600">
                      {product.brand.name}
                      <span className="block text-xs text-slate-500">{product.category.name}</span>
                    </td>
                    <td className="tabular whitespace-nowrap text-right">
                      <span
                        className={cn('font-semibold', product.discountPercent > 0 && 'text-sale')}
                      >
                        {formatSom(product.currentPrice)}
                      </span>
                      {product.discountPercent > 0 ? (
                        <span className="block text-xs text-slate-400">
                          <s>{formatSom(product.basePrice)}</s> −{product.discountPercent}%
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        'tabular text-right font-semibold',
                        product.availableStock === 0
                          ? 'text-sale'
                          : product.lowStock
                            ? 'text-warning'
                            : 'text-slate-900',
                      )}
                    >
                      {product.availableStock === 0 ? 'Yo‘q' : product.availableStock}
                    </td>
                    <td className="tabular text-right text-slate-500">{product.reservedStock}</td>
                    <td className="tabular text-right text-slate-500">{product.soldCount}</td>
                    <td>
                      {product.isActive ? (
                        <Badge tone="success">Faol</Badge>
                      ) : (
                        <Badge tone="neutral">Arxivda</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={query.data.page}
            totalPages={query.data.totalPages}
            total={query.data.total}
            onPage={(page) => update({ page: String(page) })}
          />
        </>
      )}
    </div>
  );
}
