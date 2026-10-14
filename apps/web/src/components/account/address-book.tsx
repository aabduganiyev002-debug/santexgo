'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AddressSaveInput,
  addressSaveSchema,
  type AddressView,
  MAX_ADDRESSES,
  UZ_REGIONS,
} from '@santexgo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert } from '@santexgo/ui/alert';
import { Button } from '@santexgo/ui/button';
import { Field, inputClass } from '@santexgo/ui/field';
import { Modal } from '@santexgo/ui/modal';
import { Skeleton } from '@santexgo/ui/skeleton';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { applyApiErrors } from '@santexgo/ui/form-errors';
import { toast } from '@santexgo/ui/toast';

const KEY = ['account', 'addresses'] as const;

function toInput(address: AddressView): AddressSaveInput {
  return {
    label: address.label ?? '',
    region: address.region,
    district: address.district,
    street: address.street,
    house: address.house ?? '',
    apartment: address.apartment ?? '',
    landmark: address.landmark ?? '',
  };
}

/** Saqlangan manzillar: qo'shish, tahrirlash, o'chirish, asosiy qilish. */
export function AddressBook() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AddressView | 'new' | null>(null);
  const query = useQuery({ queryKey: KEY, queryFn: () => api<AddressView[]>('/addresses') });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['account'] });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/addresses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Manzil o‘chirildi');
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const makeDefault = useMutation({
    mutationFn: (address: AddressView) =>
      api(`/addresses/${address.id}`, {
        method: 'PUT',
        body: { ...toInput(address), isDefault: true },
      }),
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const addresses = query.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Manzillar</h1>
        <Button onClick={() => setEditing('new')} disabled={addresses.length >= MAX_ADDRESSES}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Manzil qo‘shish
        </Button>
      </div>

      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : query.error ? (
        <Alert tone="error">{errorMessage(query.error)}</Alert>
      ) : addresses.length === 0 ? (
        <div className="card flex flex-col items-center p-10 text-center">
          <MapPin className="h-12 w-12 text-slate-300" aria-hidden="true" />
          <p className="mt-3 font-semibold">Saqlangan manzil yo‘q</p>
          <p className="mt-1 text-sm text-slate-500">
            Manzilni saqlasangiz, buyurtma berishda qayta yozish shart emas.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="card flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{address.label ?? 'Manzil'}</p>
                {address.isDefault ? (
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                    Asosiy
                  </span>
                ) : null}
              </div>
              <p className="flex-1 text-sm text-slate-600">
                {[
                  address.region,
                  address.district,
                  [address.street, address.house].filter(Boolean).join(', '),
                  address.apartment ? `${address.apartment}-xonadon` : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
                {address.landmark ? (
                  <span className="block text-slate-500">Mo‘ljal: {address.landmark}</span>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(address)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Tahrirlash
                </Button>
                {!address.isDefault ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={makeDefault.isPending && makeDefault.variables?.id === address.id}
                    onClick={() => makeDefault.mutate(address)}
                  >
                    <Star className="h-4 w-4" aria-hidden="true" />
                    Asosiy qilish
                  </Button>
                ) : null}
                <Button
                  variant="ghostDanger"
                  size="sm"
                  loading={remove.isPending && remove.variables === address.id}
                  onClick={() => {
                    if (window.confirm('Manzil o‘chirilsinmi?')) remove.mutate(address.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  O‘chirish
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Yangi manzil' : 'Manzilni tahrirlash'}
      >
        {editing !== null ? (
          <AddressForm
            key={editing === 'new' ? 'new' : editing.id}
            address={editing === 'new' ? null : editing}
            onSaved={() => {
              setEditing(null);
              toast.success('Manzil saqlandi');
              void refresh();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

const FIELDS = ['label', 'region', 'district', 'street', 'house', 'apartment', 'landmark'] as const;

function AddressForm({ address, onSaved }: { address: AddressView | null; onSaved: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddressSaveInput>({
    resolver: zodResolver(addressSaveSchema),
    defaultValues: address
      ? { ...toInput(address), isDefault: address.isDefault }
      : {
          label: '',
          region: 'Toshkent shahri',
          district: '',
          street: '',
          house: '',
          apartment: '',
          landmark: '',
          isDefault: false,
        },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api(address ? `/addresses/${address.id}` : '/addresses', {
        method: address ? 'PUT' : 'POST',
        body: values,
      });
      onSaved();
    } catch (error) {
      setFormError(applyApiErrors(error, setError, FIELDS));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      {formError ? (
        <Alert tone="error" className="sm:col-span-2">
          {formError}
        </Alert>
      ) : null}
      <Field
        label="Nomi (ixtiyoriy)"
        placeholder="Uy, Ish, Obyekt"
        error={errors.label?.message}
        className="sm:col-span-2"
        {...register('label')}
      />
      <div className="space-y-1.5">
        <label htmlFor="address-region" className="block text-sm font-medium text-slate-700">
          Viloyat
        </label>
        <select
          id="address-region"
          className={inputClass(Boolean(errors.region))}
          {...register('region')}
        >
          {UZ_REGIONS.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </div>
      <Field label="Tuman / shahar" error={errors.district?.message} {...register('district')} />
      <Field
        label="Ko‘cha, mahalla"
        error={errors.street?.message}
        className="sm:col-span-2"
        {...register('street')}
      />
      <Field label="Uy" error={errors.house?.message} {...register('house')} />
      <Field label="Xonadon" error={errors.apartment?.message} {...register('apartment')} />
      <Field
        label="Mo‘ljal"
        error={errors.landmark?.message}
        className="sm:col-span-2"
        {...register('landmark')}
      />
      {!address?.isDefault ? (
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" {...register('isDefault')} />
          Asosiy manzil qilish
        </label>
      ) : null}
      <Button type="submit" size="lg" loading={isSubmitting} className="sm:col-span-2">
        Saqlash
      </Button>
    </form>
  );
}
