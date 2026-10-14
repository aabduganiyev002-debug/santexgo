import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'error' | 'success' | 'info';

const STYLES: Record<Tone, string> = {
  error: 'border-red-200 bg-sale-soft text-red-800',
  success: 'border-emerald-200 bg-success-soft text-emerald-800',
  info: 'border-brand-200 bg-brand-50 text-brand-900',
};

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info };

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm', STYLES[tone], className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
