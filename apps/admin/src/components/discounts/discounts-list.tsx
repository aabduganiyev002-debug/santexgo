'use client';

import {
  type AdminDiscountListItem,
  DISCOUNT_STATUS_LABELS,
  DISCOUNT_STATUSES,
  type DiscountStatus,
  type Paginated,
} from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { Badge } from '@santexgo/ui/badge';
import { buttonClass } from '@santexgo/ui/button';
import { cn } from '@santexgo/ui/cn';
import { formatDateTime, formatSom } from '@santexgo/ui/format';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/data/states';
import { PageHeader } from '@/components/page-header';
import { useListParams } from '@/lib/use-list-params';

export const STATUS_TONES: Record<DiscountStatus, 'success' | 'brand' | 'neutral' | 'warning'> = {
  active: 'success',
  scheduled: 'brand',
  expired: 'neutral',
  disabled: 'warning',
};

export function discountValueLabel(d: { type: 'PERCENT' | 'FIXED'; value: number }): string {
  return d.type === 'PERCENT' ? `−${d.value}%` : `−${formatSom(d.value)}`;
}

function targetsLabel(d: AdminDiscountListItem): string {
  const parts = [
    d.targets.productCount > 0 ? `${d.targets.productCount} ta mahsulot` : null,
    ...d.targets.categories,
    ...d.targets.brands,
  ].filter(Boolean);
  return parts.join(', ') || '—';
}

export function DiscountsList() {
  const router = useRouter();
  const { values, update, apiQuery } = useListParams({ q: '', status: 'all', page: '1' });
  const query = useQuery({
    queryKey: ['admin', 'discounts', 'list', apiQuery],
    queryFn: () => api<Paginated<AdminDiscountListItem>>(`/admin/discounts?${apiQuery}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Chegirmalar"
        description="Bir mahsulotga bir nechta chegirma tegishli bo‘lsa — mijoz uchun eng foydalisi qo‘llanadi"
        actions={
          <Link href="/discounts/new" className={buttonClass('primary')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Chegirma yaratish
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['all', ...DISCOUNT_STATUSES] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => update({ status })}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium',
              values.status === status
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-200',
            )}
          >
            {status === 'all' ? 'Barchasi' : DISCOUNT_STATUS_LABELS[status]}
          </button>
        ))}
        <SearchInput
          value={values.q}
          onChange={(q) => update({ q })}
          placeholder="Nomi bo‘yicha"
          className="w-full sm:ml-auto sm:w-64"
        />
      </div>
      {query.isPending ? (
        <TableSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : query.data.items.length === 0 ? (
        <EmptyState title="Chegirma topilmadi" />
      ) : (
        <>
          <div className={cn('card overflow-x-auto', query.isFetching && 'opacity-70')}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nomi</th>
                  <th>Chegirma</th>
                  <th>Nimaga</th>
                  <th>Muddati</th>
                  <th className="text-right">Qo‘llangan</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((d) => (
                  <tr
                    key={d.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/discounts/${d.id}`)}
                  >
                    <td className="font-medium">
                      <Link
                        href={`/discounts/${d.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-brand-700"
                      >
                        {d.name}
                      </Link>
                    </td>
                    <td className="tabular font-semibold text-sale">{discountValueLabel(d)}</td>
                    <td className="max-w-64 truncate text-slate-600" title={targetsLabel(d)}>
                      {targetsLabel(d)}
                    </td>
                    <td className="whitespace-nowrap text-xs text-slate-600">
                      {formatDateTime(d.startsAt)}
                      <br />
                      {d.endsAt ? `→ ${formatDateTime(d.endsAt)}` : 'muddatsiz'}
                    </td>
                    <td className="tabular text-right">{d.appliedCount}</td>
                    <td>
                      <Badge tone={STATUS_TONES[d.status]}>
                        {DISCOUNT_STATUS_LABELS[d.status]}
                      </Badge>
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
