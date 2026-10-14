'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type AuthResponse, type LoginInput, loginSchema } from '@santexgo/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthCard } from '@/components/auth/auth-card';
import { PasswordInput } from '@santexgo/ui/password-input';
import { PhoneInput } from '@santexgo/ui/phone-input';
import { Alert } from '@santexgo/ui/alert';
import { Button } from '@santexgo/ui/button';
import { api } from '@santexgo/ui/api-client';
import { safeNextPath, useSetSession } from '@santexgo/ui/auth';
import { applyApiErrors } from '@santexgo/ui/form-errors';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const setSession = useSetSession();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const response = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: loginSchema.parse(values),
        skipRefresh: true,
      });
      setSession(response);
      router.replace(next);
      router.refresh();
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['phone', 'password']));
    }
  });

  return (
    <AuthCard
      title="Kirish"
      subtitle="Telefon raqam va parol bilan"
      footer={
        <>
          Akkauntingiz yo‘qmi?{' '}
          <Link
            href={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="font-semibold text-brand-700 hover:underline"
          >
            Ro‘yxatdan o‘ting
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <PhoneInput control={control} name="phone" autoFocus />
        <PasswordInput
          label="Parol"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-brand-700 hover:underline"
          >
            Parolni unutdingizmi?
          </Link>
        </div>
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Kirish
        </Button>
      </form>
    </AuthCard>
  );
}
