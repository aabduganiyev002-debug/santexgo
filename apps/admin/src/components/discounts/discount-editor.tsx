'use client';

import {
  type AdminDiscountDetail,
  type AdminDiscountProduct,
  type AdminProductListItem,
  DISCOUNT_STATUS_LABELS,
  discountInputSchema,
  discountUpdateSchema,
  type Paginated,
} from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Badge } from '@santexgo/ui/badge';
import { Button } from '@santexgo/ui/button';
import { cn } from '@santexgo/ui/cn';
import { Field, inputClass } from '@santexgo/ui/field';
import { formatSom } from '@santexgo/ui/format';
import { toast } from '@santexgo/ui/toast';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Pagination } from '@/components/data/pagination';
import { ErrorState, TableSkeleton } from '@/components/data/states';
import { FormSection, SelectField, Toggle } from '@/components/form/controls';
import { PageHeader } from '@/components/page-header';
import { categoryOptionLabel, useBrands, useCategories } from '@/lib/reference-data';
import { STATUS_TONES } from './discounts-list';

/** ISO → "2026-10-07T14:30" (brauzer vaqti, datetime-local uchun) */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface Picked {
  id: string;
  sku: string;
  name: string;
}

export function DiscountEditor({ id }: { id: string | null }) {
  const query = useQuery({
    queryKey: ['admin', 'discounts', 'detail', id],
    enabled: id !== null,
    queryFn: () => api<AdminDiscountDetail>(`/admin/discounts/${id}`),
  });
  if (id !== null && query.isPending) return <TableSkeleton rows={8} />;
  if (query.error) return <ErrorState error={query.error} />;
  return <DiscountForm key={query.data?.updatedAt ?? 'new'} discount={query.data ?? null} />;
}

function DiscountForm({ discount }: { discount: AdminDiscountDetail | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const brands = useBrands();
  const categories = useCategories();
  const [name, setName] = useState(discount?.name ?? '');
  const [type, setType] = useState<'PERCENT' | 'FIXED'>(discount?.type ?? 'PERCENT');
  const [value, setValue] = useState(discount ? String(discount.value) : '');
  const [startsAt, setStartsAt] = useState(toLocalInput(discount?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(discount?.endsAt));
  const [priority, setPriority] = useState(String(discount?.priority ?? 0));
  const [isActive, setIsActive] = useState(discount?.isActive ?? true);
  const [products, setProducts] = useState<Picked[]>(discount?.targetProducts ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(
    discount?.targetCategories.map((c) => c.id) ?? [],
  );
  const [brandIds, setBrandIds] = useState<string[]>(discount?.targetBrands.map((b) => b.id) ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const remove = useMutation({
    mutationFn: () => api(`/admin/discounts/${discount!.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'discounts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Chegirma o‘chirildi — narxlar asl holiga qaytdi');
      router.replace('/discounts');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const save = async () => {
    setFormError(null);
    setErrors({});
    const input = {
      name,
      type,
      value: value === '' ? undefined : value,
      startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      priority,
      isActive,
      targets: { productIds: products.map((p) => p.id), categoryIds, brandIds },
    };
    const parsed = (discount ? discountUpdateSchema : discountInputSchema).safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setSaving(true);
    try {
      const saved = await api<AdminDiscountDetail>(
        discount ? `/admin/discounts/${discount.id}` : '/admin/discounts',
        { method: discount ? 'PATCH' : 'POST', body: input },
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'discounts'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success(`Saqlandi: ${saved.appliedCount} ta mahsulotga qo‘llandi`);
      if (discount) queryClient.setQueryData(['admin', 'discounts', 'detail', saved.id], saved);
      else router.replace(`/discounts/${saved.id}`);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <div>
      <PageHeader
        back={{ href: '/discounts', label: 'Chegirmalar' }}
        title={discount ? discount.name : 'Yangi chegirma'}
        description={
          discount ? (
            <span className="flex items-center gap-2">
              <Badge tone={STATUS_TONES[discount.status]}>
                {DISCOUNT_STATUS_LABELS[discount.status]}
              </Badge>
              Hozir {discount.appliedCount} ta mahsulotga qo‘llangan
            </span>
          ) : (
            'Foizli yoki aniq summali; mahsulot, kategoriya (ichki kategoriyalari bilan) yoki brendga'
          )
        }
        actions={
          discount ? (
            <Button
              variant="ghostDanger"
              size="sm"
              loading={remove.isPending}
              onClick={() => {
                if (window.confirm('Chegirma o‘chirilsinmi? Narxlar asl holiga qaytadi.')) {
                  remove.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              O‘chirish
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <FormSection title="Chegirma">
            <Field
              label="Nomi"
              placeholder="Kuzgi aksiya: Plastherm −15%"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label="Turi"
                value={type}
                onChange={(e) => setType(e.target.value as 'PERCENT' | 'FIXED')}
              >
                <option value="PERCENT">Foiz (%)</option>
                <option value="FIXED">Summa (so‘m)</option>
              </SelectField>
              <Field
                label={type === 'PERCENT' ? 'Foiz' : 'Summa (so‘m)'}
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
                error={errors.value}
              />
              <Field
                label="Ustuvorlik"
                inputMode="numeric"
                hint="Teng foydada — kattasi"
                value={priority}
                onChange={(e) => setPriority(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Boshlanishi"
                type="datetime-local"
                hint="Bo‘sh — hozirdan"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                error={errors.startsAt}
              />
              <Field
                label="Tugashi"
                type="datetime-local"
                hint="Bo‘sh — muddatsiz"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                error={errors.endsAt}
              />
            </div>
            <Toggle
              label="Yoqilgan"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
          </FormSection>

          <FormSection
            title="Nimaga qo‘llanadi"
            description="Kamida bittasini tanlang. Kategoriya tanlansa — ichki kategoriyalarga ham"
          >
            {errors.targets ? <Alert tone="error">{errors.targets}</Alert> : null}
            <ProductPicker
              selected={products}
              onAdd={(p) =>
                setProducts((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]))
              }
              onRemove={(pid) => setProducts((list) => list.filter((x) => x.id !== pid))}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <CheckList
                title="Kategoriyalar"
                items={(categories.data ?? []).map((c) => ({
                  id: c.id,
                  label: categoryOptionLabel(c),
                }))}
                selected={categoryIds}
                onToggle={(cid) => toggle(categoryIds, setCategoryIds, cid)}
              />
              <CheckList
                title="Brendlar"
                items={(brands.data ?? []).map((b) => ({ id: b.id, label: b.name }))}
                selected={brandIds}
                onToggle={(bid) => toggle(brandIds, setBrandIds, bid)}
              />
            </div>
          </FormSection>

          <div className="flex justify-end">
            <Button size="lg" loading={saving} onClick={() => void save()}>
              {discount ? 'Saqlash' : 'Chegirmani yaratish'}
            </Button>
          </div>
        </div>
        {discount ? <AffectedProducts discountId={discount.id} /> : null}
      </div>
    </div>
  );
}

function CheckList({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">
        {title} {selected.length > 0 ? `(${selected.length})` : ''}
      </legend>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 whitespace-pre text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={selected.includes(item.id)}
              onChange={() => onToggle(item.id)}
            />
            {item.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Mahsulot qidirib qo'shish (nomi yoki SKU). */
function ProductPicker({
  selected,
  onAdd,
  onRemove,
}: {
  selected: Picked[];
  onAdd: (p: Picked) => void;
  onRemove: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const search = useQuery({
    queryKey: ['admin', 'products', 'picker', q],
    enabled: q.trim().length >= 2,
    queryFn: () =>
      api<Paginated<AdminProductListItem>>(
        `/admin/products?q=${encodeURIComponent(q.trim())}&pageSize=8&status=active`,
      ),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">
        Mahsulotlar {selected.length > 0 ? `(${selected.length})` : ''}
      </p>
      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <li
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-xs text-brand-800"
            >
              {p.name}
              <button
                type="button"
                aria-label={`${p.name} — olib tashlash`}
                onClick={() => onRemove(p.id)}
                className="rounded-full p-0.5 hover:bg-brand-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Mahsulot qidirish: nomi yoki SKU"
          aria-label="Mahsulot qidirish"
          className={inputClass(false, 'h-10 text-sm')}
        />
        {q.trim().length >= 2 && search.data ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-[var(--shadow-pop)]">
            {search.data.items.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">Topilmadi</li>
            ) : (
              search.data.items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onAdd({ id: p.id, sku: p.sku, name: p.name });
                      setQ('');
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {p.sku} · {formatSom(p.basePrice)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Chegirma tegishli mahsulotlar: asl narx, shu chegirma bilan narx, qo'llanganmi. */
function AffectedProducts({ discountId }: { discountId: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', 'discounts', 'products', discountId, page],
    queryFn: () =>
      api<Paginated<AdminDiscountProduct>>(
        `/admin/discounts/${discountId}/products?page=${page}&pageSize=20`,
      ),
    placeholderData: keepPreviousData,
  });
  return (
    <section className="card self-start overflow-x-auto">
      <h2 className="p-4 pb-2 font-semibold">Tegishli mahsulotlar</h2>
      {query.isPending ? (
        <div className="p-4">
          <TableSkeleton rows={4} />
        </div>
      ) : query.data && query.data.items.length > 0 ? (
        <>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th className="text-right">Asl narx</th>
                <th className="text-right">Shu chegirma bilan</th>
                <th className="text-right">Joriy narx</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.sku}</p>
                  </td>
                  <td className="tabular text-right text-slate-500">{formatSom(p.basePrice)}</td>
                  <td className="tabular text-right">{formatSom(p.priceWithThisDiscount)}</td>
                  <td className="tabular text-right">
                    <span className={cn('font-semibold', p.isApplied && 'text-sale')}>
                      {formatSom(p.currentPrice)}
                    </span>
                    {!p.isApplied && p.appliedDiscountName ? (
                      <span className="block text-xs text-slate-500">
                        Foydaliroq: {p.appliedDiscountName}
                      </span>
                    ) : null}
                  </td>
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
        </>
      ) : (
        <p className="p-4 text-sm text-slate-500">Mahsulot yo‘q</p>
      )}
    </section>
  );
}
