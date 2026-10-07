'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AddressView,
  CHECKOUT_PAYMENT_METHODS,
  type CheckoutFormInput,
  checkoutFormSchema,
  type DeliveryMethod,
  type DeliverySettings,
  type OrderDetailView,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
  UZ_REGIONS,
} from '@santexgo/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CreditCard, MapPin, Store, Truck, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { type Resolver, useForm, useWatch } from 'react-hook-form';
import { OrderSummary } from '@/components/cart/order-summary';
import { PhoneInput, formatPhoneInput } from '@/components/auth/phone-input';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClass, Spinner } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/client';
import { isApiError } from '@/lib/api/errors';
import { useMe } from '@/lib/auth';
import { useCartView } from '@/lib/cart-view';
import { cn } from '@/lib/cn';
import { applyApiErrors } from '@/lib/form-errors';
import { formatSom } from '@/lib/format';
import { useCart, withoutServerSync } from '@/lib/stores/cart';
import { ChoiceCard } from './choice-card';

const NEW_ADDRESS = 'new';

interface CheckoutValues {
  firstName: string;
  lastName: string;
  phone: string;
  deliveryMethod: DeliveryMethod;
  /** Saqlangan manzil ID yoki "new" */
  addressChoice: string;
  address: {
    label: string;
    region: string;
    district: string;
    street: string;
    house: string;
    apartment: string;
    landmark: string;
  };
  saveAddress: boolean;
  comment: string;
  paymentMethod: PaymentMethod;
}

const FORM_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'deliveryMethod',
  'address',
  'addressId',
  'comment',
  'paymentMethod',
] as const;

/** Forma qiymatlaridan API so'rovi: tanlangan usulga keraksiz maydonlar olib tashlanadi. */
function toPayload(values: CheckoutValues): CheckoutFormInput {
  const base = {
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone,
    deliveryMethod: values.deliveryMethod,
    comment: values.comment,
    paymentMethod: values.paymentMethod,
  };
  if (values.deliveryMethod === 'PICKUP') return base;
  if (values.addressChoice !== NEW_ADDRESS) return { ...base, addressId: values.addressChoice };
  return { ...base, address: values.address, saveAddress: values.saveAddress };
}

const resolver: Resolver<CheckoutValues> = (values, context, options) =>
  zodResolver(checkoutFormSchema)(
    toPayload(values),
    context,
    options as never,
  ) as unknown as ReturnType<Resolver<CheckoutValues>>;

function addressLine(
  address: Pick<AddressView, 'region' | 'district' | 'street' | 'house' | 'apartment'>,
) {
  return [
    address.region,
    address.district,
    [address.street, address.house].filter(Boolean).join(', '),
    address.apartment ? `${address.apartment}-xonadon` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

const PAYMENT_ICONS: Partial<Record<PaymentMethod, ReactNode>> = {
  CASH: <Banknote className="h-5 w-5" aria-hidden="true" />,
  CARD_ON_DELIVERY: <CreditCard className="h-5 w-5" aria-hidden="true" />,
};

/** Buyurtmani rasmiylashtirish: qabul qiluvchi, yetkazib berish, manzil, to'lov, izoh. */
export function CheckoutPage({ delivery }: { delivery: DeliverySettings }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: userLoading } = useMe();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [formError, setFormError] = useState<string | null>(null);
  const [cartErrors, setCartErrors] = useState<string[]>([]);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    if (!userLoading && !user && !placed) {
      router.replace(`/login?next=${encodeURIComponent('/checkout')}`);
    }
  }, [user, userLoading, placed, router]);

  const addresses = useQuery({
    queryKey: ['account', 'addresses'],
    enabled: Boolean(user),
    queryFn: () => api<AddressView[]>('/addresses'),
  });

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues>({
    resolver,
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      deliveryMethod: 'DELIVERY',
      addressChoice: NEW_ADDRESS,
      address: {
        label: '',
        region: 'Toshkent shahri',
        district: '',
        street: '',
        house: '',
        apartment: '',
        landmark: '',
      },
      saveAddress: true,
      comment: '',
      paymentMethod: 'CASH',
    },
  });

  // Mijoz ma'lumotlari va asosiy manzil oldindan to'ldiriladi
  useEffect(() => {
    if (!user) return;
    if (!getValues('firstName')) setValue('firstName', user.firstName);
    if (!getValues('lastName')) setValue('lastName', user.lastName);
    if (!getValues('phone')) setValue('phone', formatPhoneInput(user.phone));
  }, [user, getValues, setValue]);
  useEffect(() => {
    const saved = addresses.data;
    if (saved && saved.length > 0 && getValues('addressChoice') === NEW_ADDRESS) {
      setValue('addressChoice', (saved.find((a) => a.isDefault) ?? saved[0]!).id);
    }
  }, [addresses.data, getValues, setValue]);

  const deliveryMethod = useWatch({ control, name: 'deliveryMethod' });
  const addressChoice = useWatch({ control, name: 'addressChoice' });
  const { lines, view, stale, isLoading, refetch } = useCartView(deliveryMethod);

  const orderable = view?.lines.filter((line) => line.issue !== 'OUT_OF_STOCK') ?? [];
  const skipped = (view?.lines.length ?? 0) - orderable.length;

  // Resolver tekshiruvdan o'tkazgan; so'rov forma qiymatlaridan qayta yig'iladi
  const onSubmit = handleSubmit(async () => {
    if (!view || stale) return;
    setFormError(null);
    setCartErrors([]);
    try {
      const order = await api<OrderDetailView>('/orders', {
        method: 'POST',
        body: {
          ...checkoutFormSchema.parse(toPayload(getValues())),
          items: orderable.map((line) => ({ productId: line.productId, quantity: line.quantity })),
          expectedTotal: view.summary.total,
          idempotencyKey,
        },
      });
      setPlaced(true);
      // Buyurtmaga kirgan mahsulotlar savatchadan olinadi (serverda ham allaqachon olingan)
      withoutServerSync(() => {
        for (const line of orderable) useCart.getState().remove(line.productId);
      });
      await queryClient.invalidateQueries({ queryKey: ['account'] });
      router.replace(`/checkout/success/${order.number}`);
    } catch (error) {
      if (isApiError(error, 'CART_CHANGED')) {
        setCartErrors(error.errors.map((e) => e.message));
        void refetch();
      } else if (isApiError(error, 'PRICE_CHANGED')) {
        setFormError(error.message);
        void refetch();
      } else {
        setFormError(applyApiErrors(error, setError as never, FORM_FIELDS));
      }
    }
  });

  if (placed) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-slate-600">
        <Spinner className="h-8 w-8 text-brand-600" />
        Buyurtma rasmiylashtirilmoqda…
      </div>
    );
  }
  if (userLoading || !user || (isLoading && lines.length > 0)) return <CheckoutSkeleton />;
  if (lines.length === 0) {
    return (
      <div className="card flex flex-col items-center p-10 text-center">
        <h2 className="text-xl font-bold">Savatcha bo‘sh</h2>
        <p className="mt-2 text-slate-600">Buyurtma berish uchun avval mahsulot tanlang.</p>
        <Link href="/catalog" className={buttonClass('primary', 'lg', 'mt-6')}>
          Katalogga o‘tish
        </Link>
      </div>
    );
  }

  const savedAddresses = addresses.data ?? [];
  const showNewAddress = deliveryMethod === 'DELIVERY' && addressChoice === NEW_ADDRESS;
  const blocked = !view || view.hasIssues || orderable.length === 0;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start"
    >
      <div className="space-y-4">
        <Section step={1} title="Qabul qiluvchi">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Ism"
              autoComplete="given-name"
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <Field
              label="Familiya"
              autoComplete="family-name"
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>
          <PhoneInput
            control={control}
            name="phone"
            label="Telefon raqam (operator qo‘ng‘irog‘i uchun)"
          />
        </Section>

        <Section step={2} title="Yetkazib berish">
          <div className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              value="DELIVERY"
              icon={<Truck className="h-5 w-5" />}
              title="Yetkazib berish"
              description={
                delivery.freeFrom !== null
                  ? `${formatSom(delivery.freeFrom)} dan bepul`
                  : 'Manzilingizgacha'
              }
              aside={delivery.baseFee > 0 ? formatSom(delivery.baseFee) : 'Bepul'}
              {...register('deliveryMethod')}
            />
            {delivery.pickupEnabled ? (
              <ChoiceCard
                value="PICKUP"
                icon={<Store className="h-5 w-5" />}
                title="Do‘kondan olib ketish"
                description={delivery.pickupAddress ?? 'Do‘kon manzili operator orqali aytiladi'}
                aside={<span className="text-success">Bepul</span>}
                {...register('deliveryMethod')}
              />
            ) : null}
          </div>
          {delivery.note ? <p className="text-sm text-slate-500">{delivery.note}</p> : null}

          {deliveryMethod === 'DELIVERY' ? (
            <div className="space-y-3 pt-1">
              {savedAddresses.length > 0 ? (
                <fieldset className="space-y-2">
                  <legend className="mb-2 text-sm font-medium text-slate-700">Manzil</legend>
                  {savedAddresses.map((address) => (
                    <ChoiceCard
                      key={address.id}
                      value={address.id}
                      icon={<MapPin className="h-5 w-5" />}
                      title={address.label ?? addressLine(address)}
                      description={
                        address.label ? addressLine(address) : (address.landmark ?? undefined)
                      }
                      {...register('addressChoice')}
                    />
                  ))}
                  <ChoiceCard
                    value={NEW_ADDRESS}
                    title="Yangi manzil"
                    {...register('addressChoice')}
                  />
                </fieldset>
              ) : null}

              {showNewAddress ? (
                <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="region" className="block text-sm font-medium text-slate-700">
                      Viloyat
                    </label>
                    <select
                      id="region"
                      className={inputClass(Boolean(errors.address?.region))}
                      {...register('address.region')}
                    >
                      {UZ_REGIONS.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    label="Tuman / shahar"
                    placeholder="Chilonzor tumani"
                    error={errors.address?.district?.message}
                    {...register('address.district')}
                  />
                  <Field
                    label="Ko‘cha, mahalla"
                    placeholder="Bunyodkor ko‘chasi"
                    autoComplete="address-line1"
                    error={errors.address?.street?.message}
                    className="sm:col-span-2"
                    {...register('address.street')}
                  />
                  <Field
                    label="Uy"
                    error={errors.address?.house?.message}
                    {...register('address.house')}
                  />
                  <Field
                    label="Xonadon"
                    error={errors.address?.apartment?.message}
                    {...register('address.apartment')}
                  />
                  <Field
                    label="Mo‘ljal"
                    placeholder="Masalan: maktab yonida"
                    error={errors.address?.landmark?.message}
                    className="sm:col-span-2"
                    {...register('address.landmark')}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      {...register('saveAddress')}
                    />
                    Manzilni keyingi buyurtmalar uchun saqlash
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
        </Section>

        <Section step={3} title="To‘lov turi">
          <div className="grid gap-3 sm:grid-cols-2">
            {PAYMENT_METHODS.map((method) => {
              const available = (CHECKOUT_PAYMENT_METHODS as readonly string[]).includes(method);
              return (
                <ChoiceCard
                  key={method}
                  value={method}
                  disabled={!available}
                  icon={PAYMENT_ICONS[method] ?? <Wallet className="h-5 w-5" aria-hidden="true" />}
                  title={PAYMENT_METHOD_LABELS[method]}
                  description={available ? 'Mahsulotni qabul qilganda' : 'Tez orada'}
                  {...register('paymentMethod')}
                />
              );
            })}
          </div>
        </Section>

        <Section step={4} title="Izoh (ixtiyoriy)">
          <textarea
            rows={3}
            maxLength={500}
            placeholder="Masalan: qo‘ng‘iroq qilib keyin keling, 3-qavat, lift yo‘q"
            className={inputClass(Boolean(errors.comment), 'h-auto py-2.5')}
            aria-label="Izoh"
            {...register('comment')}
          />
          {errors.comment ? <p className="text-sm text-sale">{errors.comment.message}</p> : null}
        </Section>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24">
        <section className="card p-4" aria-label="Buyurtmadagi mahsulotlar">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Mahsulotlar</h2>
            <Link href="/cart" className="text-sm font-medium text-brand-700 hover:underline">
              O‘zgartirish
            </Link>
          </div>
          <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {orderable.map((line) => (
              <li key={line.productId} className="flex items-center gap-3 text-sm">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-white">
                  {line.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan WebP rasm
                    <img
                      src={line.image.thumb}
                      alt=""
                      className="h-full w-full object-contain p-0.5"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 leading-5 text-slate-800">{line.name}</p>
                  <p className="tabular text-xs text-slate-500">
                    {line.quantity} × {formatSom(line.price.current)}
                  </p>
                </div>
                <p className="tabular shrink-0 font-semibold">{formatSom(line.lineTotal)}</p>
              </li>
            ))}
          </ul>
          {skipped > 0 ? (
            <p className="mt-3 text-sm text-warning">
              {skipped} ta mahsulot sotuvda yo‘q — buyurtmaga kirmaydi
            </p>
          ) : null}
        </section>

        {view ? (
          <OrderSummary
            summary={view.summary}
            stale={stale}
            deliveryLabel={deliveryMethod === 'PICKUP' ? 'Olib ketish' : 'Yetkazib berish'}
          >
            {cartErrors.length > 0 ? (
              <Alert tone="error">
                <p className="font-semibold">Savatcha o‘zgardi:</p>
                <ul className="mt-1 list-disc pl-4">
                  {cartErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
                <Link href="/cart" className="mt-2 inline-block font-semibold underline">
                  Savatchaga qaytish
                </Link>
              </Alert>
            ) : view.hasIssues ? (
              <Alert tone="error">
                Ayrim mahsulotlar miqdorini{' '}
                <Link href="/cart" className="font-semibold underline">
                  savatchada
                </Link>{' '}
                tuzating.
              </Alert>
            ) : null}
            {formError ? <Alert tone="error">{formError}</Alert> : null}
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={isSubmitting}
              disabled={blocked || stale}
            >
              Buyurtmani tasdiqlash
            </Button>
            <p className="text-center text-xs text-slate-500">
              Operator buyurtmani tasdiqlash uchun siz bilan bog‘lanadi. To‘lov mahsulotni qabul
              qilganda amalga oshiriladi.
            </p>
          </OrderSummary>
        ) : (
          <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
        )}
      </aside>
    </form>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="card space-y-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2.5 text-lg font-bold">
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm text-white',
          )}
          aria-hidden="true"
        >
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card space-y-3 p-5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}
