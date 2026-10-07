import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'sale' | 'new' | 'success' | 'warning' | 'neutral' | 'brand';

const TONES: Record<Tone, string> = {
  sale: 'bg-sale text-white',
  new: 'bg-slate-900 text-white',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  neutral: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-50 text-brand-700',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold leading-4',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
