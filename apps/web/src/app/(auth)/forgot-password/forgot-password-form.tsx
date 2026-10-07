'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AuthResponse,
  newPasswordSchema,
  passwordResetSchema,
  PASSWORDS_MISMATCH,
  type SendCodeInput,
  sendCodeSchema,
  type SendCodeResponse,
  z,
} from '@santexgo/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthCard } from '@/components/auth/auth-card';
import { CodeStep } from '@/components/auth/code-step';
import { PasswordInput } from '@santexgo/ui/password-input';
import { PhoneInput } from '@santexgo/ui/phone-input';
import { Alert } from '@santexgo/ui/alert';
import { Button } from '@santexgo/ui/button';
import { api } from '@santexgo/ui/api-client';
import { ApiRequestError, errorMessage, isApiError } from '@santexgo/ui/api-errors';
import { useSetSession } from '@santexgo/ui/auth';
import { applyApiErrors } from '@santexgo/ui/form-errors';

const newPasswordForm = z
  .object({ password: newPasswordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, PASSWORDS_MISMATCH);
type NewPasswordInput = z.input<typeof newPasswordForm>;

/** Parolni tiklash: 1) telefon → SMS kod, 2) kod + yangi parol → avtomatik kirish. */
export function ForgotPasswordForm() {
  const router = useRouter();
  const setSession = useSetSession();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [resendIn, setResendIn] = useState(60);
  const [formError, setFormError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const phoneForm = useForm<SendCodeInput>({
    resolver: zodResolver(sendCodeSchema),
    defaultValues: { phone: '' },
  });
  const passwordForm = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordForm),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  async function sendCode(value: string): Promise<number> {
    try {
      return (
        await api<SendCodeResponse>('/auth/password-reset/send-code', {
          method: 'POST',
          body: { phone: value },
        })
      ).resendIn;
    } catch (error) {
      if (isApiError(error, 'CODE_RESEND_TOO_SOON'))
        return (error as ApiRequestError).retryAfter ?? 60;
      throw error;
    }
  }

  const submitPhone = phoneForm.handleSubmit(async (values) => {
    setFormError(null);
    try {
      setResendIn(await sendCode(values.phone));
      setPhone(values.phone);
      setStep('code');
    } catch (error) {
      setFormError(applyApiErrors(error, phoneForm.setError, ['phone']));
    }
  });

  async function submitReset(code: string) {
    const valid = await passwordForm.trigger();
    if (!valid) return;
    setSubmitting(true);
    setFormError(null);
    setCodeError(undefined);
    try {
      const response = await api<AuthResponse>('/auth/password-reset', {
        method: 'POST',
        body: passwordResetSchema.parse({ phone, code, ...passwordForm.getValues() }),
        skipRefresh: true,
      });
      setSession(response);
      router.replace('/');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.code.startsWith('CODE_')) {
        setCodeError(error.message);
      } else {
        setFormError(
          applyApiErrors(error, passwordForm.setError, ['password', 'passwordConfirm']) ??
            errorMessage(error),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Parolni tiklash"
      subtitle={
        step === 'phone'
          ? 'Telefon raqamingizga SMS kod yuboramiz'
          : 'Kod va yangi parolni kiriting'
      }
      footer={
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Kirish sahifasiga qaytish
        </Link>
      }
    >
      {step === 'phone' ? (
        <form onSubmit={submitPhone} className="space-y-4" noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <PhoneInput control={phoneForm.control} name="phone" autoFocus />
          <Button type="submit" size="lg" fullWidth loading={phoneForm.formState.isSubmitting}>
            Kod yuborish
          </Button>
        </form>
      ) : (
        <CodeStep
          phone={phone}
          resendIn={resendIn}
          onResend={async () => {
            try {
              return await sendCode(phone);
            } catch (error) {
              setFormError(errorMessage(error));
              return null;
            }
          }}
          onBack={() => setStep('phone')}
          onSubmit={submitReset}
          submitting={submitting}
          error={formError}
          codeError={codeError}
          submitLabel="Parolni o‘zgartirish"
        >
          <PasswordInput
            label="Yangi parol"
            autoComplete="new-password"
            hint="Kamida 8 belgi: harf va raqam"
            error={passwordForm.formState.errors.password?.message}
            {...passwordForm.register('password')}
          />
          <PasswordInput
            label="Yangi parolni tasdiqlang"
            autoComplete="new-password"
            error={passwordForm.formState.errors.passwordConfirm?.message}
            {...passwordForm.register('passwordConfirm')}
          />
        </CodeStep>
      )}
    </AuthCard>
  );
}
