'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AuthResponse,
  type RegisterDetailsInput,
  registerDetailsSchema,
  registerSchema,
  type SendCodeResponse,
} from '@santexgo/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthCard } from '@/components/auth/auth-card';
import { CodeStep } from '@/components/auth/code-step';
import { PasswordInput } from '@/components/auth/password-input';
import { PhoneInput } from '@/components/auth/phone-input';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { api } from '@/lib/api/client';
import { ApiRequestError, errorMessage, isApiError } from '@/lib/api/errors';
import { safeNextPath, useSetSession } from '@/lib/auth';
import { applyApiErrors } from '@/lib/form-errors';

const FIELDS = ['firstName', 'lastName', 'phone', 'password', 'passwordConfirm'] as const;

/** Ro'yxatdan o'tish: 1) ma'lumotlar → SMS kod yuboriladi, 2) kod → akkaunt yaratiladi va kiriladi. */
export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const setSession = useSetSession();
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [details, setDetails] = useState<RegisterDetailsInput | null>(null);
  const [resendIn, setResendIn] = useState(60);
  const [formError, setFormError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<RegisterDetailsInput>({
    resolver: zodResolver(registerDetailsSchema),
    defaultValues: { firstName: '', lastName: '', phone: '', password: '', passwordConfirm: '' },
  });

  async function sendCode(phone: string): Promise<number | null> {
    try {
      const response = await api<SendCodeResponse>('/auth/register/send-code', {
        method: 'POST',
        body: { phone },
      });
      return response.resendIn;
    } catch (error) {
      if (isApiError(error, 'CODE_RESEND_TOO_SOON'))
        return (error as ApiRequestError).retryAfter ?? 60;
      throw error;
    }
  }

  const submitDetails = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const wait = await sendCode(values.phone);
      setDetails(values);
      setResendIn(wait ?? 60);
      setCodeError(undefined);
      setStep('code');
    } catch (error) {
      setFormError(applyApiErrors(error, form.setError, FIELDS));
    }
  });

  async function submitCode(code: string) {
    if (!details) return;
    setSubmitting(true);
    setFormError(null);
    setCodeError(undefined);
    try {
      const response = await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: registerSchema.parse({ ...details, code }),
        skipRefresh: true,
      });
      setSession(response);
      router.replace(next);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.code.startsWith('CODE_')) {
        setCodeError(error.message);
      } else if (isApiError(error, 'PHONE_TAKEN')) {
        setStep('details');
        form.setError('phone', { message: error.message });
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Ro‘yxatdan o‘tish"
      subtitle={
        step === 'details'
          ? 'Buyurtmalaringizni kuzatish va tez rasmiylashtirish uchun'
          : 'Telefon raqamni tasdiqlang'
      }
      footer={
        <>
          Akkauntingiz bormi?{' '}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">
            Kiring
          </Link>
        </>
      }
    >
      {step === 'details' ? (
        <form onSubmit={submitDetails} className="space-y-4" noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Ism"
              autoComplete="given-name"
              autoFocus
              error={form.formState.errors.firstName?.message}
              {...form.register('firstName')}
            />
            <Field
              label="Familiya"
              autoComplete="family-name"
              error={form.formState.errors.lastName?.message}
              {...form.register('lastName')}
            />
          </div>
          <PhoneInput control={form.control} name="phone" />
          <PasswordInput
            label="Parol"
            autoComplete="new-password"
            hint="Kamida 8 belgi: harf va raqam"
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <PasswordInput
            label="Parolni tasdiqlang"
            autoComplete="new-password"
            error={form.formState.errors.passwordConfirm?.message}
            {...form.register('passwordConfirm')}
          />
          <Button type="submit" size="lg" fullWidth loading={form.formState.isSubmitting}>
            SMS kod yuborish
          </Button>
          <p className="text-center text-xs text-slate-500">
            Ro‘yxatdan o‘tish orqali shaxsiy ma’lumotlaringiz buyurtmalarni bajarish uchun
            ishlatilishiga rozilik bildirasiz.
          </p>
        </form>
      ) : (
        <CodeStep
          phone={form.getValues('phone')}
          resendIn={resendIn}
          onResend={async () => {
            try {
              return await sendCode(form.getValues('phone'));
            } catch (error) {
              setFormError(errorMessage(error));
              return null;
            }
          }}
          onBack={() => setStep('details')}
          onSubmit={submitCode}
          submitting={submitting}
          error={formError}
          codeError={codeError}
          submitLabel="Ro‘yxatdan o‘tish"
        />
      )}
    </AuthCard>
  );
}
