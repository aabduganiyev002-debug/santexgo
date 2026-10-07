'use client';

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from './cn';
import { useToasts } from './toast';

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

/** Qisqa xabarlar ("Savatchaga qo'shildi") — ekranning pastida, telefonda menyu ustida. */
export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-[var(--shadow-pop)]"
          >
            <Icon
              className={cn(
                'h-5 w-5 shrink-0',
                t.tone === 'success'
                  ? 'text-emerald-400'
                  : t.tone === 'error'
                    ? 'text-red-400'
                    : 'text-brand-300',
              )}
              aria-hidden="true"
            />
            <span className="flex-1">{t.message}</span>
            {t.action ? (
              <Link
                href={t.action.href}
                onClick={() => dismiss(t.id)}
                className="font-semibold text-brand-300 hover:underline"
              >
                {t.action.label}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Yopish"
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
