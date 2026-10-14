'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type AdminBrand, type BrandInput, brandInputSchema } from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Badge } from '@santexgo/ui/badge';
import { Button } from '@santexgo/ui/button';
import { Field } from '@santexgo/ui/field';
import { applyApiErrors } from '@santexgo/ui/form-errors';
import { Modal } from '@santexgo/ui/modal';
import { toast } from '@santexgo/ui/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/data/states';
import { TextAreaField, Toggle } from '@/components/form/controls';
import { ImagePicker } from '@/components/form/image-picker';
import { PageHeader } from '@/components/page-header';
import { REF_KEYS, useBrands } from '@/lib/reference-data';

/** Brendlar: logo, mahsulotlar soni, mashhur (bosh sahifada), yashirish. */
export function BrandsPage() {
  const queryClient = useQueryClient();
  const brands = useBrands();
  const [editing, setEditing] = useState<AdminBrand | 'new' | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: REF_KEYS.brands });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/brands/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Brend o‘chirildi');
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div>
      <PageHeader
        title="Brendlar"
        description="“Mashhur” brendlar bosh sahifada ko‘rinadi"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Brend qo‘shish
          </Button>
        }
      />
      {brands.isPending ? (
        <TableSkeleton />
      ) : brands.error ? (
        <ErrorState error={brands.error} />
      ) : brands.data.length === 0 ? (
        <EmptyState title="Brend yo‘q" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Brend</th>
                <th>Davlat</th>
                <th className="text-right">Mahsulotlar</th>
                <th>Holat</th>
                <th className="text-right">Tartib</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {brands.data.map((brand) => (
                <tr key={brand.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-16 items-center justify-center overflow-hidden rounded-md border border-slate-100 bg-white">
                        {brand.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan rasm
                          <img
                            src={brand.logoUrl}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Tags className="h-4 w-4 text-slate-300" aria-hidden="true" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{brand.name}</p>
                        <p className="text-xs text-slate-500">/{brand.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-slate-600">{brand.country ?? '—'}</td>
                  <td className="tabular text-right">
                    <Link
                      href={`/products?brandId=${brand.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {brand.productCount}
                    </Link>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {brand.isActive ? (
                        <Badge tone="success">Faol</Badge>
                      ) : (
                        <Badge>Yashirin</Badge>
                      )}
                      {brand.isFeatured ? <Badge tone="brand">Mashhur</Badge> : null}
                    </div>
                  </td>
                  <td className="tabular text-right text-slate-500">{brand.sortOrder}</td>
                  <td className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(brand)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Tahrirlash
                    </Button>
                    <Button
                      variant="ghostDanger"
                      size="sm"
                      aria-label={`${brand.name} — o‘chirish`}
                      loading={remove.isPending && remove.variables === brand.id}
                      onClick={() => {
                        if (window.confirm(`“${brand.name}” brendi o‘chirilsinmi?`)) {
                          remove.mutate(brand.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Yangi brend' : 'Brendni tahrirlash'}
      >
        {editing !== null ? (
          <BrandForm
            key={editing === 'new' ? 'new' : editing.id}
            brand={editing === 'new' ? null : editing}
            onSaved={(brand, created) => {
              void refresh();
              if (created) {
                setEditing(brand);
                toast.success('Brend qo‘shildi. Logotipini yuklang');
              } else {
                setEditing(null);
                toast.success('Saqlandi');
              }
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

const FIELDS = ['name', 'slug', 'description', 'country', 'website', 'sortOrder'] as const;

function BrandForm({
  brand,
  onSaved,
}: {
  brand: AdminBrand | null;
  onSaved: (brand: AdminBrand, created: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState(brand?.logoUrl ?? null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BrandInput>({
    resolver: zodResolver(brandInputSchema),
    defaultValues: {
      name: brand?.name ?? '',
      slug: brand?.slug ?? '',
      description: brand?.description ?? '',
      country: brand?.country ?? '',
      website: brand?.website ?? '',
      sortOrder: brand?.sortOrder ?? 0,
      isFeatured: brand?.isFeatured ?? false,
      isActive: brand?.isActive ?? true,
    },
  });

  const logo = useMutation({
    mutationFn: (file: File | null) => {
      if (!file) return api<AdminBrand>(`/admin/brands/${brand!.id}/logo`, { method: 'DELETE' });
      const form = new FormData();
      form.append('file', file);
      return api<AdminBrand>(`/admin/brands/${brand!.id}/logo`, { method: 'POST', body: form });
    },
    onSuccess: (updated) => {
      setLogoUrl(updated.logoUrl);
      void queryClient.invalidateQueries({ queryKey: REF_KEYS.brands });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = await api<AdminBrand>(brand ? `/admin/brands/${brand.id}` : '/admin/brands', {
        method: brand ? 'PATCH' : 'POST',
        body: values,
      });
      onSaved(saved, brand === null);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, FIELDS));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {brand ? (
        <ImagePicker
          label="Logotip"
          url={logoUrl}
          aspect="wide"
          busy={logo.isPending}
          onPick={(file) => logo.mutate(file)}
          onRemove={() => logo.mutate(null)}
        />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nomi" error={errors.name?.message} {...register('name')} />
        <Field
          label="Manzil (slug)"
          placeholder="Bo‘sh qolsa — nomidan"
          error={errors.slug?.message}
          {...register('slug')}
        />
        <Field label="Davlat" error={errors.country?.message} {...register('country')} />
        <Field
          label="Sayti"
          placeholder="https://..."
          error={errors.website?.message}
          {...register('website')}
        />
        <Field
          label="Tartib raqami"
          inputMode="numeric"
          hint="Kichigi oldinda"
          error={errors.sortOrder?.message}
          {...register('sortOrder')}
        />
      </div>
      <TextAreaField
        label="Tavsif"
        rows={3}
        error={errors.description?.message}
        {...register('description')}
      />
      <div className="flex flex-wrap gap-6">
        <Toggle label="Saytda ko‘rinadi" {...register('isActive')} />
        <Toggle label="Mashhur brend" hint="Bosh sahifada" {...register('isFeatured')} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {brand ? 'Saqlash' : 'Qo‘shish'}
        </Button>
      </div>
    </form>
  );
}
