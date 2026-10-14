'use client';

import {
  type AdminCustomerListItem,
  CUSTOMER_SORT_LABELS,
  CUSTOMER_SORTS,
  formatUzPhone,
  type Paginated,
} from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { Badge } from '@santexgo/ui/badge';
import { cn } from '@santexgo/ui/cn';
import { inputClass } from '@santexgo/ui/field';
import { formatDate, formatSom } from '@santexgo/ui/format';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/data/states';
import { PageHeader } from '@/components/page-header';
import { useListParams } from '@/lib/use-list-params';

const selectClass = inputClass(false, 'h-10 w-auto text-sm');

/** Mijozlar bazasi: ism, telefon, buyurtmalar soni, umumiy xarid summasi. */
export function CustomersList() {
  const router = useRouter();
  const { values, update, apiQuery } = useListParams({
    q: '',
    sort: 'recent',
    status: 'all',
    page: '1',
  });
  const query = useQuery({
    queryKey: ['admin', 'customers', 'list', apiQuery],
    queryFn: () => api<Paginated<AdminCustomerListItem>>(`/admin/customers?${apiQuery}`),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader
        title="Mijozlar"
        description="Umumiy xarid summasi — yetkazilgan buyurtmalar bo‘yicha"
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput
          value={values.q}
          onChange={(q) => update({ q })}
          placeholder="Ism, familiya yoki telefon"
          className="w-full sm:w-72"
        />
        <select
          aria-label="Saralash"
          value={values.sort}
          onChange={(e) => update({ sort: e.target.value })}
          className={selectClass}
        >
          {CUSTOMER_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {CUSTOMER_SORT_LABELS[sort]}
            </option>
          ))}
        </select>
        <select
          aria-label="Holat"
          value={values.status}
          onChange={(e) => update({ status: e.target.value })}
          className={selectClass}
        >
          <option value="all">Barchasi</option>
          <option value="active">Faol</option>
          <option value="blocked">Bloklangan</option>
        </select>
      </div>
      {query.isPending ? (
        <TableSkeleton />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : query.data.items.length === 0 ? (
        <EmptyState title="Mijoz topilmadi" />
      ) : (
        <>
          <div className={cn('card overflow-x-auto', query.isFetching && 'opacity-70')}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mijoz</th>
                  <th>Telefon</th>
                  <th className="text-right">Buyurtmalar</th>
                  <th className="text-right">Xarid summasi</th>
                  <th>Oxirgi buyurtma</th>
                  <th>Ro‘yxatdan o‘tgan</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <td className="font-medium">
                      <Link
                        href={`/customers/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-brand-700"
                      >
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="tabular whitespace-nowrap text-slate-600">
                      {formatUzPhone(c.phone)}
                    </td>
                    <td className="tabular text-right">{c.ordersCount}</td>
                    <td className="tabular whitespace-nowrap text-right font-semibold">
                      {formatSom(c.totalSpent)}
                    </td>
                    <td className="whitespace-nowrap text-slate-600">
                      {c.lastOrderAt ? formatDate(c.lastOrderAt) : '—'}
                    </td>
                    <td className="whitespace-nowrap text-slate-600">{formatDate(c.createdAt)}</td>
                    <td>
                      {c.isActive ? (
                        <Badge tone="success">Faol</Badge>
                      ) : (
                        <Badge tone="sale">Bloklangan</Badge>
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
