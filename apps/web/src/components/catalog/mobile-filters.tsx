'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FilterPanel, type FilterPanelProps } from './filter-panel';

/** Telefonda: "Filtrlar" tugmasi — pastdan ochiladigan to'liq ekranli oyna. */
export function MobileFilters({
  total,
  activeCount,
  ...panel
}: FilterPanelProps & { total: number; activeCount: number }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="lg:hidden">
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filtrlar
        {activeCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs text-white">
            {activeCount}
          </span>
        ) : null}
      </Button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-white p-0 backdrop:bg-black/40 lg:hidden"
        aria-label="Filtrlar"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-bold">Filtrlar</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Yopish"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {open ? <FilterPanel {...panel} /> : null}
          </div>
          <div className="border-t border-slate-200 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button fullWidth size="lg" onClick={() => setOpen(false)}>
              {total} ta mahsulotni ko‘rsatish
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
