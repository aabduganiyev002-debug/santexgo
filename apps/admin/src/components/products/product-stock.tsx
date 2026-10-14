'use client';

import {
  type AdminInventoryMovement,
  type AdminProductDetail,
  type AdminWarehouseStock,
  INVENTORY_MOVEMENT_LABELS,
  type Paginated,
} from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Button } from '@santexgo/ui/button';
import { cn } from '@santexgo/ui/cn';
import { Field } from '@santexgo/ui/field';
import { formatDateTime, unitLabel } from '@santexgo/ui/format';
import { Modal } from '@santexgo/ui/modal';
import { toast } from '@santexgo/ui/toast';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, PackagePlus, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { SelectField } from '@/components/form/controls';
import { Pagination } from '@/components/data/pagination';

type Operation = 'add' | 'remove' | 'set';

const OPERATIONS: Record<Operation, { title: string; label: string; hint: string }> = {
  add: { title: 'Kirim', label: 'Kelgan miqdor', hint: 'Omborga yangi tovar keldi' },
  remove: {
    title: 'Chiqim / hisobdan chiqarish',
    label: 'Chiqarilgan miqdor',
    hint: 'Shikastlangan, yo‘qolgan yoki boshqa sabab',
  },
  set: {
    title: 'Inventarizatsiya',
    label: 'Haqiqiy qoldiq (sanab chiqilgan)',
    hint: 'Ombordagi aniq son kiritiladi',
  },
};

/** Ombor: omborlar bo'yicha qoldiq, band qilingan, kirim/chiqim/inventarizatsiya. */
export function ProductStock({ product }: { product: AdminProductDetail }) {
  const queryClient = useQueryClient();
  const [operation, setOperation] = useState<Operation | null>(null);
  const [warehouseId, setWarehouseId] = useState(product.stock[0]?.warehouseId ?? '');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  const adjust = useMutation({
    mutationFn: () =>
      api<AdminWarehouseStock[]>(`/admin/products/${product.id}/inventory`, {
        method: 'POST',
        body: {
          operation,
          warehouseId: warehouseId || undefined,
          quantity,
          note: note || undefined,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Qoldiq yangilandi');
      setOperation(null);
      setQuantity('');
      setNote('');
    },
  });

  const total = product.stock.reduce(
    (sum, s) => ({ quantity: sum.quantity + s.quantity, reserved: sum.reserved + s.reserved }),
    { quantity: 0, reserved: 0 },
  );
  const unit = unitLabel(product.unit);

  return (
    <section className="card p-4">
      <h2 className="mb-3 font-semibold">Ombor</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Omborda" value={total.quantity} />
        <Metric label="Band" value={total.reserved} hint="Jo‘natilmagan buyurtmalar" />
        <Metric
          label="Sotuvda"
          value={product.availableStock}
          tone={product.availableStock === 0 ? 'bad' : product.lowStock ? 'warn' : 'good'}
        />
      </div>
      {product.stock.length > 1 ? (
        <table className="admin-table mt-3">
          <tbody>
            {product.stock.map((s) => (
              <tr key={s.warehouseId}>
                <td>
                  {s.warehouseName}
                  {s.isDefault ? (
                    <span className="ml-1 text-xs text-slate-500">(asosiy)</span>
                  ) : null}
                </td>
                <td className="tabular text-right">{s.quantity}</td>
                <td className="tabular text-right text-slate-500">{s.reserved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {product.availableStock === 0 ? (
        <p className="mt-3 text-sm font-semibold text-sale">Saytda: “SOTUVDA YO‘Q”</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setOperation('add')}>
          <PackagePlus className="h-4 w-4" aria-hidden="true" />
          Kirim
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOperation('remove')}>
          <Minus className="h-4 w-4" aria-hidden="true" />
          Chiqim
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOperation('set')}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Inventarizatsiya
        </Button>
      </div>

      <Modal
        open={operation !== null}
        onClose={() => setOperation(null)}
        title={operation ? OPERATIONS[operation].title : ''}
      >
        {operation ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              adjust.mutate();
            }}
          >
            <p className="text-sm text-slate-600">{OPERATIONS[operation].hint}</p>
            {product.stock.length > 1 ? (
              <SelectField
                label="Ombor"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                {product.stock.map((s) => (
                  <option key={s.warehouseId} value={s.warehouseId}>
                    {s.warehouseName} — {s.quantity} {unit}
                  </option>
                ))}
              </SelectField>
            ) : null}
            <Field
              label={`${OPERATIONS[operation].label} (${unit})`}
              inputMode="numeric"
              autoFocus
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ''))}
            />
            <Field
              label="Izoh"
              placeholder={operation === 'add' ? 'Masalan: 15-son yuk xati' : 'Sababi'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {adjust.error ? <Alert tone="error">{errorMessage(adjust.error)}</Alert> : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOperation(null)}>
                Bekor qilish
              </Button>
              <Button type="submit" loading={adjust.isPending} disabled={quantity === ''}>
                Saqlash
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2" title={hint}>
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={cn(
          'tabular text-lg font-bold',
          tone === 'bad' && 'text-sale',
          tone === 'warn' && 'text-warning',
          tone === 'good' && 'text-success',
        )}
      >
        {value.toLocaleString('ru-RU')}
      </p>
    </div>
  );
}

/** Ombor harakatlari tarixi: kirim, chiqim, buyurtma bandi, jo'natish, qaytarish. */
export function StockMovements({ productId }: { productId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', 'products', 'movements', productId, page],
    queryFn: () =>
      api<Paginated<AdminInventoryMovement>>(
        `/admin/products/${productId}/inventory/movements?page=${page}&pageSize=15`,
      ),
    placeholderData: keepPreviousData,
  });
  if (!query.data || query.data.items.length === 0) return null;
  return (
    <section className="card mt-4 overflow-x-auto p-0">
      <h2 className="p-4 pb-2 font-semibold">Ombor harakatlari</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Sana</th>
            <th>Harakat</th>
            <th className="text-right">Qoldiq</th>
            <th className="text-right">Band</th>
            <th className="text-right">Keyin</th>
            <th>Buyurtma / izoh</th>
            <th>Kim</th>
          </tr>
        </thead>
        <tbody>
          {query.data.items.map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap text-slate-600">{formatDateTime(m.createdAt)}</td>
              <td>{INVENTORY_MOVEMENT_LABELS[m.type]}</td>
              <td
                className={cn(
                  'tabular text-right font-medium',
                  m.quantityChange > 0 && 'text-success',
                  m.quantityChange < 0 && 'text-sale',
                )}
              >
                {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange || '—'}
              </td>
              <td className="tabular text-right text-slate-500">
                {m.reservedChange > 0 ? `+${m.reservedChange}` : m.reservedChange || '—'}
              </td>
              <td className="tabular whitespace-nowrap text-right text-slate-600">
                {m.quantityAfter} / {m.reservedAfter}
              </td>
              <td className="text-slate-600">
                {m.orderNumber ? (
                  <Link
                    href={`/orders/ORDER-${m.orderNumber}`}
                    className="tabular text-brand-700 hover:underline"
                  >
                    ORDER-{m.orderNumber}
                  </Link>
                ) : null}
                {m.note ? <span className="block text-xs">{m.note}</span> : null}
              </td>
              <td className="text-slate-500">{m.createdBy ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 pb-4">
        <Pagination
          page={query.data.page}
          totalPages={query.data.totalPages}
          total={query.data.total}
          onPage={setPage}
        />
      </div>
    </section>
  );
}
