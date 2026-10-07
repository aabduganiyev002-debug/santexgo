import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';
import { cn } from '@santexgo/ui/cn';

/** Radio tugma — katta bosiladigan kartochka ko'rinishida (yetkazib berish, to'lov, manzil). */
export const ChoiceCard = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'title'> & {
    title: ReactNode;
    description?: ReactNode;
    aside?: ReactNode;
    icon?: ReactNode;
  }
>(function ChoiceCard({ title, description, aside, icon, className, disabled, ...props }, ref) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-colors',
        'hover:border-brand-300 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50/50 has-[:checked]:ring-1 has-[:checked]:ring-brand-600',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600',
        disabled && 'cursor-not-allowed opacity-60 hover:border-slate-200',
        className,
      )}
    >
      <input
        ref={ref}
        type="radio"
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
        {...props}
      />
      {icon ? <span className="shrink-0 text-slate-500">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-sm text-slate-500">{description}</span>
        ) : null}
      </span>
      {aside ? <span className="shrink-0 text-sm font-semibold">{aside}</span> : null}
    </label>
  );
});
