'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type AuthResponse, type LoginInput, loginSchema } from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { safeNextPath, useSetSession } from '@santexgo/ui/auth';
import { Button } from '@santexgo/ui/button';
import { applyApiErrors } from '@santexgo/ui/form-errors';
import { PasswordInput } from '@santexgo/ui/password-input';
import { PhoneInput } from '@santexgo/ui/phone-input';
import { ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

/** Admin panelga kirish: telefon va parol; faqat ADMIN roli uchun. */
export function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
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
      if (response.user.role !== 'ADMIN') {
        await api('/auth/logout', { method: 'POST', skipRefresh: true }).catch(() => undefined);
        setFormError('Bu akkauntda admin panelga kirish huquqi yo‘q');
        return;
      }
      setSession(response);
      router.replace(next);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['phone', 'password']));
    }
  });

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex items-center justify-center gap-2 text-white">
        <ShieldCheck className="h-7 w-7 text-brand-400" aria-hidden="true" />
        <span className="text-xl font-bold">SantexGo Admin</span>
      </div>
      <form onSubmit={onSubmit} noValidate className="card space-y-4 p-6">
        <h1 className="text-lg font-bold">Admin panelga kirish</h1>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <PhoneInput control={control} name="phone" autoFocus />
        <PasswordInput
          label="Parol"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
          Kirish
        </Button>
      </form>
    </div>
  );
}
