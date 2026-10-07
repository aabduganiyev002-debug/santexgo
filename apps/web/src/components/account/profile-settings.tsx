'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AuthUser,
  type ChangePasswordInput,
  changePasswordSchema,
  formatUzPhone,
  type ProfileUpdateInput,
  profileUpdateSchema,
  type SendCodeInput,
  sendCodeSchema,
  type SendCodeResponse,
} from '@santexgo/shared';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, Phone, User } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CodeStep } from '@/components/auth/code-step';
import { PasswordInput } from '@santexgo/ui/password-input';
import { PhoneInput } from '@santexgo/ui/phone-input';
import { Alert } from '@santexgo/ui/alert';
import { Button } from '@santexgo/ui/button';
import { Field } from '@santexgo/ui/field';
import { Skeleton } from '@santexgo/ui/skeleton';
import { api } from '@santexgo/ui/api-client';
import { errorMessage, isApiError } from '@santexgo/ui/api-errors';
import { ME_QUERY_KEY, useMe } from '@santexgo/ui/auth';
import { applyApiErrors } from '@santexgo/ui/form-errors';
import { toast } from '@santexgo/ui/toast';

/** Profil va xavfsizlik: ism-familiya, telefon raqami (SMS bilan), parol. */
export function ProfileSettings() {
  const { user } = useMe();
  if (!user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Profil va xavfsizlik</h1>
      <NameCard user={user} />
      <PhoneCard user={user} />
      <PasswordCard />
    </div>
  );
}

function Card({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="card p-4 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function useUpdateMe() {
  const queryClient = useQueryClient();
  return (user: AuthUser) => {
    queryClient.setQueryData(ME_QUERY_KEY, user);
    void queryClient.invalidateQueries({ queryKey: ['account', 'overview'] });
  };
}

function NameCard({ user }: { user: AuthUser }) {
  const updateMe = useUpdateMe();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const updated = await api<AuthUser>('/account/profile', {
        method: 'PATCH',
        body: profileUpdateSchema.parse(values),
      });
      updateMe(updated);
      reset({ firstName: updated.firstName, lastName: updated.lastName });
      toast.success('Ma’lumotlar saqlandi');
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['firstName', 'lastName']));
    }
  });

  return (
    <Card icon={<User className="h-5 w-5" />} title="Shaxsiy ma’lumotlar">
      <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        {formError ? (
          <Alert tone="error" className="sm:col-span-2">
            {formError}
          </Alert>
        ) : null}
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
        <div className="sm:col-span-2">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            Saqlash
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PhoneCard({ user }: { user: AuthUser }) {
  const updateMe = useUpdateMe();
  const [step, setStep] = useState<'view' | 'phone' | 'code'>('view');
  const [resendIn, setResendIn] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<SendCodeInput>({
    resolver: zodResolver(sendCodeSchema),
    defaultValues: { phone: '' },
  });
  const newPhone = () => sendCodeSchema.parse(form.getValues()).phone;

  const sendCode = async (phone: string): Promise<number> => {
    const res = await api<SendCodeResponse>('/account/phone/send-code', {
      method: 'POST',
      body: { phone },
    });
    return res.resendIn;
  };

  const onSendCode = form.handleSubmit(async () => {
    setFormError(null);
    try {
      setResendIn(await sendCode(newPhone()));
      setStep('code');
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError, ['phone']));
    }
  });

  const onConfirm = async (code: string) => {
    setSubmitting(true);
    setFormError(null);
    setCodeError(undefined);
    try {
      const updated = await api<AuthUser>('/account/phone', {
        method: 'POST',
        body: { phone: newPhone(), code },
      });
      updateMe(updated);
      toast.success('Telefon raqami o‘zgartirildi');
      form.reset({ phone: '' });
      setStep('view');
    } catch (error) {
      if (isApiError(error) && error.code.startsWith('CODE_')) setCodeError(error.message);
      else setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      icon={<Phone className="h-5 w-5" />}
      title="Telefon raqami"
      description="Kirish va buyurtmalar bo‘yicha qo‘ng‘iroq shu raqamga"
    >
      {step === 'view' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-lg font-semibold">{formatUzPhone(user.phone)}</p>
          <Button variant="outline" onClick={() => setStep('phone')}>
            O‘zgartirish
          </Button>
        </div>
      ) : step === 'phone' ? (
        <form onSubmit={onSendCode} noValidate className="max-w-md space-y-4">
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <PhoneInput control={form.control} name="phone" label="Yangi telefon raqam" autoFocus />
          <div className="flex gap-2">
            <Button type="submit" loading={form.formState.isSubmitting}>
              SMS kod yuborish
            </Button>
            <Button variant="ghost" onClick={() => setStep('view')}>
              Bekor qilish
            </Button>
          </div>
        </form>
      ) : (
        <div className="max-w-md">
          <CodeStep
            phone={newPhone()}
            resendIn={resendIn}
            onResend={async () => {
              try {
                return await sendCode(newPhone());
              } catch (error) {
                setFormError(errorMessage(error));
                return null;
              }
            }}
            onBack={() => setStep('phone')}
            onSubmit={(code) => void onConfirm(code)}
            submitting={submitting}
            error={formError}
            codeError={codeError}
            submitLabel="Raqamni tasdiqlash"
          />
        </div>
      )}
    </Card>
  );
}

const PASSWORD_FIELDS = ['currentPassword', 'password', 'passwordConfirm'] as const;

function PasswordCard() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', passwordConfirm: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api('/account/password', { method: 'POST', body: values });
      reset();
      toast.success('Parol o‘zgartirildi. Boshqa qurilmalardan chiqildi');
    } catch (error) {
      setFormError(applyApiErrors(error, setError, PASSWORD_FIELDS));
    }
  });

  return (
    <Card
      icon={<KeyRound className="h-5 w-5" />}
      title="Parol"
      description="Parol o‘zgarganda boshqa qurilmalardagi sessiyalar yopiladi"
    >
      <form onSubmit={onSubmit} noValidate className="max-w-md space-y-4">
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <PasswordInput
          label="Joriy parol"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordInput
          label="Yangi parol"
          autoComplete="new-password"
          hint="Kamida 8 belgi, harf va raqam"
          error={errors.password?.message}
          {...register('password')}
        />
        <PasswordInput
          label="Yangi parolni tasdiqlang"
          autoComplete="new-password"
          error={errors.passwordConfirm?.message}
          {...register('passwordConfirm')}
        />
        <Button type="submit" loading={isSubmitting}>
          Parolni o‘zgartirish
        </Button>
      </form>
    </Card>
  );
}
