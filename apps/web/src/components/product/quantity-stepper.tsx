'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

/** "−  10  +" — miqdor tanlash (qo'lda yozish ham mumkin). */
export function QuantityStepper({
  value,
  min,
  max,
  onChange,
  size = 'md',
  label = 'Miqdor',
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const clamp = (n: number) =>
    Math.min(Math.max(Number.isFinite(n) ? Math.round(n) : min, min), Math.max(min, max));
  const button = cn(
    'flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent',
    size === 'sm' ? 'h-8 w-8' : 'h-11 w-11',
  );
  return (
    <div
      className={cn(
        'inline-flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white',
        size === 'sm' ? 'h-9' : 'h-12',
      )}
    >
      <button
        type="button"
        className={button}
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label="Kamaytirish"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className={cn(
          'tabular h-full border-x border-slate-200 text-center font-semibold [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          size === 'sm' ? 'w-12 text-sm' : 'w-16',
        )}
      />
      <button
        type="button"
        className={button}
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label="Ko‘paytirish"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
