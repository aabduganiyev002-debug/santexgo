'use client';

import { type AdminCustomerDetail, formatUzPhone } from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Badge } from '@santexgo/ui/badge';
import { Button } from '@santexgo/ui/button';
import { formatDate, formatDateTime, formatSom } from '@santexgo/ui/format';
import { OrderStatusBadge } from '@santexgo/ui/order-status-badge';
import { toast } from '@santexgo/ui/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Phone } from 'lucide-react';
import Link from 'next/link';
import { ErrorState, TableSkeleton } from '@/components/data/states';
import { PageHeader } from '@/components/page-header';

export function CustomerDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const key = ['admin', 'customers', 'detail', id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api<AdminCustomerDetail>(`/admin/customers/${id}`),
  });
  const setActive = useMutation({
    mutationFn: (isActive: boolean) =>
      api<AdminCustomerDetail>(`/admin/customers/${id}`, { method: 'PATCH', body: { isActive } }),
    onSuccess: (customer) => {
      queryClient.setQueryData(key, customer);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'customers', 'list'] });
      toast.success(customer.isActive ? 'Blokdan chiqarildi' : 'Bloklandi');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (query.isPending) return <TableSkeleton rows={8} />;
  if (query.error) return <ErrorState error={query.error} />;
  const c = query.data;

  return (
    <div>
      <PageHeader
        back={{ href: '/customers', label: 'Mijozlar' }}
        title={`${c.firstName} ${c.lastName}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <a
              href={`tel:${c.phone}`}
              className="tabular inline-flex items-center gap-1 text-brand-700"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              {formatUzPhone(c.phone)}
            </a>
            · ro‘yxatdan o‘tgan {formatDate(c.createdAt)}
            {c.lastLoginAt ? ` · oxirgi kirish ${formatDateTime(c.lastLoginAt)}` : ''}
            {c.isActive ? null : <Badge tone="sale">Bloklangan</Badge>}
          </span>
        }
        actions={
          c.isActive ? (
            <Button
              variant="ghostDanger"
              size="sm"
              loading={setActive.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Mijoz bloklansinmi? U saytga kira olmaydi va barcha qurilmalardan chiqariladi.',
                  )
                ) {
                  setActive.mutate(false);
                }
              }}
            >
              <Ban className="h-4 w-4" aria-hidden="true" />
              Bloklash
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              loading={setActive.isPending}
              onClick={() => setActive.mutate(true)}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Blokdan chiqarish
            </Button>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Buyurtmalar" value={String(c.ordersCount)} />
        <Stat label="Yetkazilgan" value={String(c.deliveredCount)} />
        <Stat label="Faol" value={String(c.activeOrdersCount)} />
        <Stat label="Jami xarid" value={formatSom(c.totalSpent)} />
        <Stat label="O‘rtacha buyurtma" value={formatSom(c.averageOrder)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section className="card overflow-x-auto">
          <div className="flex items-center justify-between p-4 pb-2">
            <h2 className="font-semibold">Oxirgi buyurtmalar</h2>
            <Link
              href={`/orders?userId=${c.id}`}
              className="text-sm text-brand-700 hover:underline"
            >
              Barchasi
            </Link>
          </div>
          {c.recentOrders.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Buyurtma yo‘q</p>
          ) : (
            <table className="admin-table">
              <tbody>
                {c.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="tabular font-semibold">
                      <Link href={`/orders/${o.number}`} className="text-brand-700 hover:underline">
                        {o.number}
                      </Link>
                    </td>
                    <td className="text-slate-600">{formatDateTime(o.createdAt)}</td>
                    <td className="tabular text-right">{formatSom(o.total)}</td>
                    <td>
                      <OrderStatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">Manzillar</h2>
          {c.addresses.length === 0 ? (
            <p className="text-sm text-slate-500">Saqlangan manzil yo‘q</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {c.addresses.map((a) => (
                <li key={a.id}>
                  <p className="font-medium">
                    {a.label ?? 'Manzil'}
                    {a.isDefault ? (
                      <Badge tone="brand" className="ml-2">
                        Asosiy
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-slate-600">
                    {[a.region, a.district, a.street, a.house].filter(Boolean).join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="tabular mt-1 truncate text-xl font-bold">{value}</p>
    </div>
  );
}
