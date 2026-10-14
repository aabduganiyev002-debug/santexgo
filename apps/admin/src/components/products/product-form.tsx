'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AdminAttribute,
  type AdminProductDetail,
  PRODUCT_UNIT_LABELS,
  PRODUCT_UNITS,
  productInputSchema,
  type ProductUnit,
  productUpdateSchema,
} from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { Button } from '@santexgo/ui/button';
import { Field, inputClass } from '@santexgo/ui/field';
import { applyApiErrors } from '@santexgo/ui/form-errors';
import { formatSom } from '@santexgo/ui/format';
import { toast } from '@santexgo/ui/toast';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { type Resolver, useForm, useWatch } from 'react-hook-form';
import { ErrorState, TableSkeleton } from '@/components/data/states';
import { FormSection, SelectField, TextAreaField, Toggle } from '@/components/form/controls';
import {
  categoryOptionLabel,
  useAttributes,
  useBrands,
  useCategories,
  useMaterials,
  useProductGroups,
} from '@/lib/reference-data';

interface ProductFormValues {
  name: string;
  sku: string;
  slug: string;
  brandId: string;
  categoryId: string;
  materialId: string;
  groupId: string;
  unit: ProductUnit;
  shortDescription: string;
  description: string;
  basePrice: string;
  minOrderQty: string;
  weightGrams: string;
  warrantyMonths: string;
  initialStock: string;
  isActive: boolean;
  isFeatured: boolean;
  metaTitle: string;
  metaDescription: string;
  /** Xususiyat kaliti → qiymat (matn ko'rinishida) */
  attributes: Record<string, string>;
}

const FIELDS = [
  'name',
  'sku',
  'slug',
  'brandId',
  'categoryId',
  'materialId',
  'groupId',
  'unit',
  'shortDescription',
  'description',
  'basePrice',
  'minOrderQty',
  'weightGrams',
  'warrantyMonths',
  'initialStock',
  'metaTitle',
  'metaDescription',
] as const;

function empty(value: string): string | undefined {
  return value.trim() === '' ? undefined : value.trim();
}

/** Forma qiymatlaridan API so'rovi (xususiyatlarsiz — ular alohida tekshiriladi). */
function toPayload(values: ProductFormValues, isNew: boolean) {
  return {
    name: values.name,
    sku: values.sku,
    slug: empty(values.slug),
    brandId: empty(values.brandId),
    categoryId: empty(values.categoryId),
    materialId: empty(values.materialId) ?? null,
    groupId: empty(values.groupId) ?? null,
    unit: values.unit,
    shortDescription: values.shortDescription,
    description: values.description,
    basePrice: empty(values.basePrice),
    minOrderQty: empty(values.minOrderQty),
    weightGrams: empty(values.weightGrams) ?? null,
    warrantyMonths: empty(values.warrantyMonths) ?? null,
    isActive: values.isActive,
    isFeatured: values.isFeatured,
    metaTitle: values.metaTitle,
    metaDescription: values.metaDescription,
    ...(isNew ? { initialStock: empty(values.initialStock) } : {}),
  };
}

function defaults(product: AdminProductDetail | null): ProductFormValues {
  return {
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    slug: product?.slug ?? '',
    brandId: product?.brandId ?? '',
    categoryId: product?.categoryId ?? '',
    materialId: product?.materialId ?? '',
    groupId: product?.groupId ?? '',
    unit: product?.unit ?? 'PIECE',
    shortDescription: product?.shortDescription ?? '',
    description: product?.description ?? '',
    basePrice: product ? String(product.basePrice) : '',
    minOrderQty: product ? String(product.minOrderQty) : '1',
    weightGrams: product?.weightGrams != null ? String(product.weightGrams) : '',
    warrantyMonths: product?.warrantyMonths != null ? String(product.warrantyMonths) : '',
    initialStock: '',
    isActive: product?.isActive ?? true,
    isFeatured: product?.isFeatured ?? false,
    metaTitle: product?.metaTitle ?? '',
    metaDescription: product?.metaDescription ?? '',
    attributes: Object.fromEntries(
      (product?.attributes ?? []).map((a) => [a.key, String(a.value)]),
    ),
  };
}

/** Xususiyat qiymati: son, matn yoki ha/yo'q. Bo'sh — o'chirish. */
function attributeValue(attribute: AdminAttribute, raw: string): number | string | boolean | null {
  const value = raw.trim();
  if (value === '') return null;
  if (attribute.type === 'NUMBER') return Number(value.replace(',', '.'));
  if (attribute.type === 'BOOLEAN') return value === 'true';
  return value;
}

/**
 * Forma ro'yxatlar (brendlar, kategoriyalar...) yuklangandan keyin chiziladi — aks holda
 * tanlangan qiymat <select> da ko'rinmay qoladi.
 */
export function ProductForm({ product }: { product: AdminProductDetail | null }) {
  const refs = [useBrands(), useCategories(), useMaterials(), useAttributes(), useProductGroups()];
  if (refs.some((q) => q.isPending)) return <TableSkeleton rows={8} />;
  const failed = refs.find((q) => q.error);
  if (failed) return <ErrorState error={failed.error} />;
  return <ProductFormInner product={product} />;
}

function ProductFormInner({ product }: { product: AdminProductDetail | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isNew = product === null;
  const brands = useBrands();
  const categories = useCategories();
  const materials = useMaterials();
  const attributes = useAttributes();
  const groups = useProductGroups();
  const [formError, setFormError] = useState<string | null>(null);
  const [extraKeys, setExtraKeys] = useState<string[]>([]);

  const resolver: Resolver<ProductFormValues> = (values, context, options) =>
    zodResolver(isNew ? productInputSchema : productUpdateSchema)(
      toPayload(values, isNew) as never,
      context,
      options as never,
    ) as unknown as ReturnType<Resolver<ProductFormValues>>;

  const {
    control,
    register,
    handleSubmit,
    setError,
    getValues,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProductFormValues>({ resolver, defaultValues: defaults(product) });

  const categoryId = useWatch({ control, name: 'categoryId' });
  const attributeValues = useWatch({ control, name: 'attributes' });

  // Ko'rsatiladigan xususiyatlar: kategoriyaniki + mahsulotda qiymati borlari + qo'lda qo'shilganlar
  const shownAttributes = useMemo(() => {
    const all = attributes.data ?? [];
    const category = categories.data?.find((c) => c.id === categoryId);
    const keys = new Set<string>([
      ...all.filter((a) => category?.attributeIds.includes(a.id)).map((a) => a.key),
      ...Object.keys(attributeValues ?? {}).filter((k) => attributeValues?.[k] !== ''),
      ...(product?.attributes.map((a) => a.key) ?? []),
      ...extraKeys,
    ]);
    return all.filter((a) => keys.has(a.key));
  }, [attributes.data, categories.data, categoryId, attributeValues, product, extraKeys]);
  const otherAttributes = (attributes.data ?? []).filter(
    (a) => !shownAttributes.some((s) => s.id === a.id),
  );

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const formValues = getValues();
    // Xususiyatlar: son turidagilar tekshiriladi
    let attributeError = false;
    const attributePayload = shownAttributes.flatMap((attribute) => {
      const raw = formValues.attributes[attribute.key] ?? '';
      const value = attributeValue(attribute, raw);
      if (attribute.type === 'NUMBER' && value !== null && !Number.isFinite(value)) {
        setError(`attributes.${attribute.key}`, { message: 'Son kiriting' });
        attributeError = true;
      }
      // Yangi mahsulotda bo'sh qiymat yuborilmaydi; tahrirlashda — o'chiriladi
      if (value === null && (isNew || !product?.attributes.some((a) => a.key === attribute.key))) {
        return [];
      }
      return [{ key: attribute.key, value }];
    });
    if (attributeError) return;

    const body = { ...(values as unknown as object), attributes: attributePayload };
    try {
      const saved = await api<AdminProductDetail>(
        isNew ? '/admin/products' : `/admin/products/${product.id}`,
        { method: isNew ? 'POST' : 'PATCH', body },
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      if (isNew) {
        toast.success('Mahsulot qo‘shildi. Endi rasmlarini yuklang');
        router.replace(`/products/${saved.id}`);
      } else {
        queryClient.setQueryData(['admin', 'products', 'detail', saved.id], saved);
        reset(defaults(saved));
        setExtraKeys([]);
        toast.success('Saqlandi');
      }
    } catch (error) {
      setFormError(applyApiErrors(error, setError as never, FIELDS));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <FormSection title="Asosiy ma’lumotlar">
        <Field
          label="Nomi"
          placeholder="Plastherm PPR truba Ø25 PN20 (4 m)"
          error={errors.name?.message}
          {...register('name')}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="SKU (artikul)"
            placeholder="PLT-PPR-PN20-25"
            error={errors.sku?.message}
            {...register('sku')}
          />
          <Field
            label="Manzil (slug)"
            placeholder="Bo‘sh qolsa — nomidan yasaladi"
            error={errors.slug?.message}
            {...register('slug')}
          />
          <SelectField label="Brend" error={errors.brandId?.message} {...register('brandId')}>
            <option value="">Tanlang</option>
            {brands.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.isActive ? '' : ' (yashirin)'}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Kategoriya"
            error={errors.categoryId?.message}
            {...register('categoryId')}
          >
            <option value="">Tanlang</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryOptionLabel(c)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Material"
            error={errors.materialId?.message}
            {...register('materialId')}
          >
            <option value="">—</option>
            {materials.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.fullName ? ` — ${m.fullName}` : ''}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Variantlar guruhi"
            hint="Bir xil mahsulotning o‘lchamlari (Ø20, Ø25, Ø32...)"
            error={errors.groupId?.message}
            {...register('groupId')}
          >
            <option value="">—</option>
            {groups.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </SelectField>
        </div>
        <Field
          label="Qisqa tavsif"
          hint="Kartochka va qidiruv natijalarida (300 belgigacha)"
          error={errors.shortDescription?.message}
          {...register('shortDescription')}
        />
        <TextAreaField
          label="To‘liq tavsif"
          rows={6}
          error={errors.description?.message}
          {...register('description')}
        />
      </FormSection>

      <FormSection title="Narx va sotuv">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Asosiy narx (so‘m)"
            inputMode="numeric"
            error={errors.basePrice?.message}
            hint={
              product && product.currentPrice < product.basePrice
                ? `Chegirma bilan: ${formatSom(product.currentPrice)} (−${product.discountPercent}%)`
                : 'Chegirma bo‘lsa, yangi narx avtomatik hisoblanadi'
            }
            {...register('basePrice')}
          />
          <SelectField label="O‘lchov birligi" {...register('unit')}>
            {PRODUCT_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {PRODUCT_UNIT_LABELS[unit]}
              </option>
            ))}
          </SelectField>
          <Field
            label="Eng kam buyurtma"
            inputMode="numeric"
            error={errors.minOrderQty?.message}
            {...register('minOrderQty')}
          />
          {isNew ? (
            <Field
              label="Boshlang‘ich qoldiq"
              inputMode="numeric"
              hint="Asosiy omborga kirim qilinadi"
              error={errors.initialStock?.message}
              {...register('initialStock')}
            />
          ) : null}
          <Field
            label="Og‘irligi (gramm)"
            inputMode="numeric"
            error={errors.weightGrams?.message}
            {...register('weightGrams')}
          />
          <Field
            label="Kafolat (oy)"
            inputMode="numeric"
            error={errors.warrantyMonths?.message}
            {...register('warrantyMonths')}
          />
        </div>
      </FormSection>

      <FormSection
        title="Texnik xususiyatlar"
        description="Filtrlar va mahsulot sahifasidagi jadval uchun (diametr, PN, devor qalinligi...)"
      >
        {shownAttributes.length === 0 ? (
          <p className="text-sm text-slate-500">
            Kategoriyani tanlang — unga biriktirilgan xususiyatlar shu yerda chiqadi.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shownAttributes.map((attribute) => {
              const label = `${attribute.name}${attribute.unit ? `, ${attribute.unit}` : ''}`;
              const error = errors.attributes?.[attribute.key]?.message;
              return attribute.type === 'BOOLEAN' ? (
                <SelectField
                  key={attribute.id}
                  label={label}
                  error={error}
                  {...register(`attributes.${attribute.key}`)}
                >
                  <option value="">—</option>
                  <option value="true">Ha</option>
                  <option value="false">Yo‘q</option>
                </SelectField>
              ) : (
                <Field
                  key={attribute.id}
                  label={label}
                  inputMode={attribute.type === 'NUMBER' ? 'decimal' : undefined}
                  error={error}
                  {...register(`attributes.${attribute.key}`)}
                />
              );
            })}
          </div>
        )}
        {otherAttributes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Boshqa xususiyat qo‘shish"
              value=""
              onChange={(e) => {
                const key = e.target.value;
                if (key) setExtraKeys((keys) => [...keys, key]);
              }}
              className={inputClass(false, 'h-9 w-auto text-sm')}
            >
              <option value="">+ Boshqa xususiyat qo‘shish</option>
              {otherAttributes.map((a) => (
                <option key={a.id} value={a.key}>
                  {a.name}
                </option>
              ))}
            </select>
            {extraKeys.length > 0 ? (
              <button
                type="button"
                onClick={() => setExtraKeys([])}
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
              >
                <X className="h-3.5 w-3.5" /> Qo‘shilganlarni olib tashlash
              </button>
            ) : null}
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Holat va SEO">
        <div className="flex flex-wrap gap-6">
          <Toggle
            label="Saytda ko‘rinadi"
            hint="O‘chirilsa — mahsulot arxivda"
            {...register('isActive')}
          />
          <Toggle
            label="Tavsiya etilgan"
            hint="Bosh sahifada ko‘proq ko‘rinadi"
            {...register('isFeatured')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="SEO sarlavha"
            hint="Bo‘sh qolsa — mahsulot nomi"
            error={errors.metaTitle?.message}
            {...register('metaTitle')}
          />
          <Field
            label="SEO tavsif"
            hint="Google natijalarida (320 belgigacha)"
            error={errors.metaDescription?.message}
            {...register('metaDescription')}
          />
        </div>
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-2 border-t border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {!isNew ? (
          <Button
            variant="ghost"
            disabled={!isDirty && extraKeys.length === 0}
            onClick={() => {
              reset(defaults(product));
              setExtraKeys([]);
            }}
          >
            Bekor qilish
          </Button>
        ) : null}
        <Button type="submit" loading={isSubmitting} disabled={!isNew && !isDirty}>
          {isNew ? 'Mahsulotni qo‘shish' : 'Saqlash'}
        </Button>
      </div>
    </form>
  );
}
