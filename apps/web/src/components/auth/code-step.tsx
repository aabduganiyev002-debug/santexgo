'use client';

import { formatUzPhone, OTP_CODE_LENGTH } from '@santexgo/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { Alert } from '@santexgo/ui/alert';
import { Button } from '@santexgo/ui/button';
import { Field } from '@santexgo/ui/field';

/** Qolgan soniyalar (qayta yuborish taymeri). */
export function useCountdown(seconds: number): [number, (s: number) => void] {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return [left, setLeft];
}

/** SMS kodni kiritish: 6 xonali, avtomatik to'ldirish (iOS/Android), qayta yuborish taymeri. */
export function CodeStep({
  phone,
  resendIn,
  onResend,
  onBack,
  onSubmit,
  submitting,
  error,
  codeError,
  submitLabel = 'Tasdiqlash',
  children,
}: {
  phone: string;
  resendIn: number;
  onResend: () => Promise<number | null>;
  onBack: () => void;
  onSubmit: (code: string) => void;
  submitting: boolean;
  error: string | null;
  codeError?: string;
  submitLabel?: string;
  children?: React.ReactNode;
}) {
  const [code, setCode] = useState('');
  const [left, setLeft] = useCountdown(resendIn);
  const [resending, setResending] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(code);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{formatUzPhone(phone)}</span> raqamiga{' '}
        {OTP_CODE_LENGTH} xonali kod yuborildi.{' '}
        <button
          type="button"
          onClick={onBack}
          className="font-semibold text-brand-700 hover:underline"
        >
          Raqamni o‘zgartirish
        </button>
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field
        label="SMS kod"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        maxLength={OTP_CODE_LENGTH}
        autoFocus
        placeholder="______"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH))}
        error={codeError}
        className="[&_input]:text-center [&_input]:text-xl [&_input]:font-bold [&_input]:tracking-[0.5em]"
      />
      {children}
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={submitting}
        disabled={code.length !== OTP_CODE_LENGTH}
      >
        {submitLabel}
      </Button>
      <div className="text-center text-sm">
        {left > 0 ? (
          <span className="text-slate-500">Kodni qayta yuborish: {left} soniya</span>
        ) : (
          <button
            type="button"
            disabled={resending}
            onClick={async () => {
              setResending(true);
              const next = await onResend();
              setResending(false);
              if (next !== null) setLeft(next);
            }}
            className="font-semibold text-brand-700 hover:underline disabled:text-slate-400"
          >
            Kodni qayta yuborish
          </button>
        )}
      </div>
    </form>
  );
}
