'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type DeliverySettings,
  deliverySettingsSchema,
  formatUzPhone,
  type SiteSettings,
  type StoreSettings,
  storeSettingsSchema,
} from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { Button } from '@santexgo/ui/button';
import { Field } from '@santexgo/ui/field';
import { applyApiErrors } from '@santexgo/ui/form-errors';
import { toast } from '@santexgo/ui/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { type Resolver, useForm } from 'react-hook-form';
import { ErrorState, TableSkeleton } from '@/components/data/states';
import { FormSection, Toggle } from '@/components/form/controls';
import { PageHeader } from '@/components/page-header';

const KEY = ['admin', 'settings'];

export function SettingsPage() {
  const query = useQuery({ queryKey: KEY, queryFn: () => api<SiteSettings>('/admin/settings') });
  if (query.isPending) return <TableSkeleton rows={8} />;
  if (query.error) return <ErrorState error={query.error} />;
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title="Sozlamalar"
        description="Saytning pastki qismi, aloqa va yetkazib berish"
      />
      <StoreForm store={query.data.store} />
      <DeliveryForm delivery={query.data.delivery} />
    </div>
  );
}

const STORE_FIELDS = [
  'name',
  'phone',
  'phone2',
  'email',
  'address',
  'workingHours',
  'telegram',
  'instagram',
] as const;

function StoreForm({ store }: { store: StoreSettings }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<StoreSettings>({
    resolver: zodResolver(storeSettingsSchema) as unknown as Resolver<StoreSettings>,
    defaultValues: {
      name: store.name,
      phone: store.phone ? formatUzPhone(store.phone) : '',
      phone2: store.phone2 ? formatUzPhone(store.phone2) : '',
      email: store.email ?? '',
      address: store.address ?? '',
      workingHours: store.workingHours ?? '',
      telegram: store.telegram ?? '',
      instagram: store.instagram ?? '',
    },
  });
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = await api<SiteSettings>('/admin/settings/store', {
        method: 'PUT',
        body: values,
      });
      queryClient.setQueryData(KEY, saved);
      reset(values);
      toast.success('Saqlandi');
    } catch (error) {
      setFormError(applyApiErrors(error, setError, STORE_FIELDS));
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate>
      <FormSection title="Do‘kon" description="Sayt sarlavhasi va pastki qismida ko‘rinadi">
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Do‘kon nomi" error={errors.name?.message} {...register('name')} />
          <Field label="Ish vaqti" placeholder="Du–Sha 9:00–18:00" {...register('workingHours')} />
          <Field
            label="Telefon"
            placeholder="+998 90 123 45 67"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Field
            label="Qo‘shimcha telefon"
            error={errors.phone2?.message}
            {...register('phone2')}
          />
          <Field label="Email" error={errors.email?.message} {...register('email')} />
          <Field label="Telegram" placeholder="@santexgo" {...register('telegram')} />
          <Field label="Instagram" placeholder="santexgo.uz" {...register('instagram')} />
        </div>
        <Field label="Manzil" error={errors.address?.message} {...register('address')} />
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Saqlash
          </Button>
        </div>
      </FormSection>
    </form>
  );
}

interface DeliveryValues {
  baseFee: string;
  freeFrom: string;
  pickupEnabled: boolean;
  pickupAddress: string;
  note: string;
}

function DeliveryForm({ delivery }: { delivery: DeliverySettings }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const resolver: Resolver<DeliveryValues> = (values, context, options) =>
    zodResolver(deliverySettingsSchema)(
      { ...values, freeFrom: values.freeFrom.trim() === '' ? null : values.freeFrom } as never,
      context,
      options as never,
    ) as unknown as ReturnType<Resolver<DeliveryValues>>;
  const {
    register,
    handleSubmit,
    setError,
    reset,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DeliveryValues>({
    resolver,
    defaultValues: {
      baseFee: String(delivery.baseFee),
      freeFrom: delivery.freeFrom === null ? '' : String(delivery.freeFrom),
      pickupEnabled: delivery.pickupEnabled,
      pickupAddress: delivery.pickupAddress ?? '',
      note: delivery.note ?? '',
    },
  });
  const onSubmit = handleSubmit(async (parsed) => {
    setFormError(null);
    try {
      const saved = await api<SiteSettings>('/admin/settings/delivery', {
        method: 'PUT',
        body: parsed,
      });
      queryClient.setQueryData(KEY, saved);
      reset(getValues());
      toast.success('Saqlandi');
    } catch (error) {
      setFormError(
        applyApiErrors(error, setError, ['baseFee', 'freeFrom', 'pickupAddress', 'note']),
      );
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate>
      <FormSection
        title="Yetkazib berish"
        description="Savatcha va buyurtma berishda avtomatik hisoblanadi"
      >
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Yetkazib berish narxi (so‘m)"
            inputMode="numeric"
            error={errors.baseFee?.message}
            {...register('baseFee')}
          />
          <Field
            label="Bepul yetkazib berish (so‘m dan)"
            inputMode="numeric"
            hint="Bo‘sh qolsa — doim pullik"
            error={errors.freeFrom?.message}
            {...register('freeFrom')}
          />
        </div>
        <Field
          label="Mijozga izoh"
          placeholder="Toshkent bo‘ylab 1–2 kunda"
          error={errors.note?.message}
          {...register('note')}
        />
        <Toggle label="Do‘kondan olib ketish mumkin" {...register('pickupEnabled')} />
        <Field
          label="Olib ketish manzili"
          error={errors.pickupAddress?.message}
          {...register('pickupAddress')}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Saqlash
          </Button>
        </div>
      </FormSection>
    </form>
  );
}
