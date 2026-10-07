'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type AdminCategory, type CategoryInput, categoryInputSchema } from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Badge } from '@santexgo/ui/badge';
import { Button } from '@santexgo/ui/button';
import { cn } from '@santexgo/ui/cn';
import { Field } from '@santexgo/ui/field';
import { applyApiErrors } from '@santexgo/ui/form-errors';
import { Modal } from '@santexgo/ui/modal';
import { toast } from '@santexgo/ui/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CornerDownRight, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/data/states';
import { SelectField, TextAreaField, Toggle } from '@/components/form/controls';
import { ImagePicker } from '@/components/form/image-picker';
import { PageHeader } from '@/components/page-header';
import { categoryOptionLabel, REF_KEYS, useAttributes, useCategories } from '@/lib/reference-data';

type Editing = { category: AdminCategory | null; parentId: string | null };

/** Kategoriyalar daraxti: Trubalar → PPR trubalar...; har biriga filtr xususiyatlari biriktiriladi. */
export function CategoriesPage() {
  const queryClient = useQueryClient();
  const categories = useCategories();
  const [editing, setEditing] = useState<Editing | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: REF_KEYS.categories });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Kategoriya o‘chirildi');
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div>
      <PageHeader
        title="Kategoriyalar"
        description="Saytdagi katalog menyusi shu tartibda ko‘rinadi"
        actions={
          <Button onClick={() => setEditing({ category: null, parentId: null })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Kategoriya qo‘shish
          </Button>
        }
      />
      {categories.isPending ? (
        <TableSkeleton />
      ) : categories.error ? (
        <ErrorState error={categories.error} />
      ) : categories.data.length === 0 ? (
        <EmptyState title="Kategoriya yo‘q" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Kategoriya</th>
                <th className="text-right">Mahsulotlar</th>
                <th className="text-right">Xususiyatlar</th>
                <th>Holat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.data.map((category) => (
                <tr key={category.id}>
                  <td>
                    <div
                      className="flex items-center gap-2"
                      style={{ paddingLeft: `${category.depth * 1.5}rem` }}
                    >
                      {category.depth > 0 ? (
                        <CornerDownRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
                      ) : null}
                      <div>
                        <p className={cn(category.depth === 0 && 'font-semibold')}>
                          {category.name}
                        </p>
                        <p className="text-xs text-slate-500">/{category.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="tabular text-right">
                    <Link
                      href={`/products?categoryId=${category.id}`}
                      className="text-brand-700 hover:underline"
                      title="Ichki kategoriyalar bilan"
                    >
                      {category.totalProductCount}
                    </Link>
                  </td>
                  <td className="tabular text-right text-slate-500">
                    {category.attributeIds.length}
                  </td>
                  <td>
                    {category.isActive ? (
                      <Badge tone="success">Faol</Badge>
                    ) : (
                      <Badge>Yashirin</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Ichki kategoriya qo‘shish"
                      onClick={() => setEditing({ category: null, parentId: category.id })}
                    >
                      <FolderPlus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing({ category, parentId: category.parentId })}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Tahrirlash
                    </Button>
                    <Button
                      variant="ghostDanger"
                      size="sm"
                      aria-label={`${category.name} — o‘chirish`}
                      onClick={() => {
                        if (window.confirm(`“${category.name}” o‘chirilsinmi?`)) {
                          remove.mutate(category.id);
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
        title={editing?.category ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
        className="max-w-2xl"
      >
        {editing !== null ? (
          <CategoryForm
            key={editing.category?.id ?? `new-${editing.parentId}`}
            category={editing.category}
            parentId={editing.parentId}
            categories={categories.data ?? []}
            onSaved={(category, created) => {
              void refresh();
              if (created) {
                setEditing({ category, parentId: category.parentId });
                toast.success('Kategoriya qo‘shildi');
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

const FIELDS = ['name', 'slug', 'parentId', 'description', 'sortOrder', 'attributeIds'] as const;

function CategoryForm({
  category,
  parentId,
  categories,
  onSaved,
}: {
  category: AdminCategory | null;
  parentId: string | null;
  categories: AdminCategory[];
  onSaved: (category: AdminCategory, created: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const attributes = useAttributes();
  const [formError, setFormError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CategoryInput>({
    // "Asosiy kategoriya" tanlansa ('' ) — ota kategoriya yo'q (null)
    resolver: (values, context, options) =>
      zodResolver(categoryInputSchema)(
        { ...values, parentId: values.parentId || null, attributeIds: values.attributeIds || [] },
        context,
        options,
      ),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      parentId: parentId ?? '',
      description: category?.description ?? '',
      sortOrder: category?.sortOrder ?? 0,
      isActive: category?.isActive ?? true,
      attributeIds: category?.attributeIds ?? [],
    },
  });

  // O'zini yoki o'zining ichki kategoriyasini ota qilib bo'lmaydi
  const descendants = new Set<string>();
  if (category) {
    descendants.add(category.id);
    for (const c of categories) {
      if (c.parentId && descendants.has(c.parentId)) descendants.add(c.id);
    }
  }

  const image = useMutation({
    mutationFn: (file: File | null) => {
      const url = `/admin/categories/${category!.id}/image`;
      if (!file) return api<AdminCategory>(url, { method: 'DELETE' });
      const form = new FormData();
      form.append('file', file);
      return api<AdminCategory>(url, { method: 'POST', body: form });
    },
    onSuccess: (updated) => {
      setImageUrl(updated.imageUrl);
      void queryClient.invalidateQueries({ queryKey: REF_KEYS.categories });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = await api<AdminCategory>(
        category ? `/admin/categories/${category.id}` : '/admin/categories',
        {
          method: category ? 'PATCH' : 'POST',
          body: values,
        },
      );
      onSaved(saved, category === null);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, FIELDS));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {category ? (
        <ImagePicker
          label="Rasm (katalog menyusi va bosh sahifa uchun)"
          url={imageUrl}
          busy={image.isPending}
          onPick={(file) => image.mutate(file)}
          onRemove={() => image.mutate(null)}
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
        <SelectField
          label="Ota kategoriya"
          error={errors.parentId?.message}
          {...register('parentId')}
        >
          <option value="">— (asosiy kategoriya)</option>
          {categories
            .filter((c) => !descendants.has(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {categoryOptionLabel(c)}
              </option>
            ))}
        </SelectField>
        <Field
          label="Tartib raqami"
          inputMode="numeric"
          error={errors.sortOrder?.message}
          {...register('sortOrder')}
        />
      </div>
      <TextAreaField
        label="Tavsif (SEO)"
        rows={2}
        error={errors.description?.message}
        {...register('description')}
      />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">
          Filtr xususiyatlari (mahsulot formasida va katalog filtrida)
        </legend>
        <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          {attributes.data?.map((attribute) => (
            <label key={attribute.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={attribute.id}
                className="h-4 w-4 accent-brand-600"
                {...register('attributeIds')}
              />
              {attribute.name}
              {attribute.unit ? <span className="text-slate-400">({attribute.unit})</span> : null}
            </label>
          ))}
        </div>
      </fieldset>
      <Toggle label="Saytda ko‘rinadi" {...register('isActive')} />
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {category ? 'Saqlash' : 'Qo‘shish'}
        </Button>
      </div>
    </form>
  );
}
