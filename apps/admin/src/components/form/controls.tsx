'use client';

import { inputClass } from '@santexgo/ui/field';
import { cn } from '@santexgo/ui/cn';
import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
      {children}
    </label>
  );
}

function Message({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error) {
    return (
      <p id={`${id}-error`} role="alert" className="text-sm text-sale">
        {error}
      </p>
    );
  }
  return hint ? <p className="text-sm text-slate-500">{hint}</p> : null;
}

export const SelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: ReactNode }
>(function SelectField({ label, error, hint, className, children, ...props }, ref) {
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        className={inputClass(Boolean(error))}
        {...props}
      >
        {children}
      </select>
      <Message id={id} error={error} hint={hint} />
    </div>
  );
});

export const TextAreaField = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: ReactNode }
>(function TextAreaField({ label, error, hint, className, rows = 4, ...props }, ref) {
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={inputClass(Boolean(error), 'h-auto py-2.5')}
        {...props}
      />
      <Message id={id} error={error} hint={hint} />
    </div>
  );
});

/** Yoqish/o'chirish tugmasi (checkbox ko'rinishi o'zgartirilgan). */
export const Toggle = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; hint?: ReactNode }
>(function Toggle({ label, hint, className, ...props }, ref) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
        <span className="h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      <span className="text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        {hint ? <span className="block text-slate-500">{hint}</span> : null}
      </span>
    </label>
  );
});

/** Forma bo'limi (kartochka) */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('card space-y-4 p-5', className)}>
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
