'use client';

import { Button } from '@santexgo/ui/button';
import { toast } from '@santexgo/ui/toast';
import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef } from 'react';

const MAX_BYTES = 10 * 1024 * 1024;

/** Bitta rasm (logo, kategoriya rasmi): ko'rinishi, almashtirish, o'chirish. */
export function ImagePicker({
  url,
  label,
  onPick,
  onRemove,
  busy,
  aspect = 'square',
}: {
  url: string | null;
  label: string;
  onPick: (file: File) => void;
  onRemove?: () => void;
  busy?: boolean;
  aspect?: 'square' | 'wide';
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <div className="flex items-center gap-3">
        <div
          className={
            aspect === 'wide'
              ? 'flex h-20 w-48 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50'
              : 'flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50'
          }
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan rasm
            <img src={url} alt="" className="h-full w-full object-contain" />
          ) : (
            <ImagePlus className="h-6 w-6 text-slate-300" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Button variant="outline" size="sm" loading={busy} onClick={() => input.current?.click()}>
            {url ? 'Almashtirish' : 'Yuklash'}
          </Button>
          {url && onRemove ? (
            <Button variant="ghostDanger" size="sm" disabled={busy} onClick={onRemove}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              O‘chirish
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (file.size > MAX_BYTES) {
            toast.error('Rasm 10 MB dan katta');
            return;
          }
          onPick(file);
        }}
      />
    </div>
  );
}
