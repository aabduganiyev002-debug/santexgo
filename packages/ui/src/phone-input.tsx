'use client';

import { type Control, Controller, type FieldValues, type Path } from 'react-hook-form';
import { Field } from './field';

/** "901234567" → "90 123 45 67" (+998 alohida ko'rsatiladi). */
export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length > 9) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return parts.filter(Boolean).join(' ');
}

export function PhoneInput<T extends FieldValues>({
  control,
  name,
  label = 'Telefon raqam',
  autoFocus,
}: {
  control: Control<T>;
  name: Path<T>;
  label?: string;
  autoFocus?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          label={label}
          prefix="+998"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="90 123 45 67"
          autoFocus={autoFocus}
          error={fieldState.error?.message}
          name={field.name}
          ref={field.ref}
          value={formatPhoneInput(String(field.value ?? ''))}
          onChange={(e) => field.onChange(formatPhoneInput(e.target.value))}
          onBlur={field.onBlur}
        />
      )}
    />
  );
}
