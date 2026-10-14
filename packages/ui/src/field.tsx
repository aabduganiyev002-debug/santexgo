import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from 'react';
import { cn } from './cn';

export const inputClass = (invalid?: boolean, extra?: string) =>
  cn(
    'h-11 w-full rounded-xl border bg-white px-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 transition-colors',
    'focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20',
    'disabled:bg-slate-50 disabled:text-slate-500',
    invalid ? 'border-sale' : 'border-slate-300',
    extra,
  );

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label: string;
  error?: string;
  hint?: ReactNode;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

/** Forma maydoni: yorliq, xato matni (ekran o'quvchilari uchun bog'langan), maslahat. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, prefix, suffix, className, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative flex items-center">
        {prefix ? (
          <span className="pointer-events-none absolute left-3.5 text-[15px] text-slate-500">
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={inputClass(
            Boolean(error),
            cn(prefix ? 'pl-14' : undefined, suffix ? 'pr-11' : undefined),
          )}
          {...props}
        />
        {suffix ? <span className="absolute right-2">{suffix}</span> : null}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-sale" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
