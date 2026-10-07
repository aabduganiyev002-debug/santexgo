'use client';

import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

/** Modal oyna (brauzerning <dialog> elementi: fokus, Esc va fon avtomatik). */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={title}
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 shadow-[var(--shadow-pop)] backdrop:bg-black/40',
        className,
      )}
    >
      {open ? (
        <div className="max-h-[85dvh] overflow-y-auto p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="-m-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Yopish"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
