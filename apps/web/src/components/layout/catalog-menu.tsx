'use client';

import type { CategoryNode } from '@santexgo/shared';
import { ChevronRight, LayoutGrid, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@santexgo/ui/cn';

/** Kompyuterdagi "Katalog" tugmasi: kategoriyalar va subkategoriyalar paneli. */
export function CatalogMenu({ categories }: { categories: CategoryNode[] }) {
  const pathname = usePathname();
  // Menyu ochilgan sahifa: boshqa sahifaga o'tilganda avtomatik yopiladi
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (value: boolean | ((current: boolean) => boolean)) => {
    const next = typeof value === 'function' ? value(open) : value;
    setOpenedOn(next ? pathname : null);
  };
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenedOn(null);
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpenedOn(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const active = categories.find((c) => c.slug === activeSlug) ?? categories[0];

  return (
    <div ref={panelRef} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white',
          open ? 'bg-brand-800' : 'bg-brand-600 hover:bg-brand-700',
        )}
      >
        {open ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <LayoutGrid className="h-5 w-5" aria-hidden="true" />
        )}
        Katalog
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 flex w-[720px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-pop)]">
          <ul className="w-64 shrink-0 border-r border-slate-100 bg-slate-50 py-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/catalog/${category.slug}`}
                  onMouseEnter={() => setActiveSlug(category.slug)}
                  onFocus={() => setActiveSlug(category.slug)}
                  className={cn(
                    'flex items-center justify-between px-4 py-2.5 text-sm',
                    active?.slug === category.slug
                      ? 'bg-white font-semibold text-brand-700'
                      : 'text-slate-700',
                  )}
                >
                  {category.name}
                  <span className="text-xs text-slate-400">{category.productCount}</span>
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-slate-200 pt-1">
              <Link
                href="/catalog"
                className="flex items-center gap-1 px-4 py-2.5 text-sm font-semibold text-brand-700"
              >
                Butun katalog
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          </ul>
          {active ? (
            <div className="flex-1 p-5">
              <Link
                href={`/catalog/${active.slug}`}
                className="text-lg font-bold hover:text-brand-700"
              >
                {active.name}
              </Link>
              {active.children.length > 0 ? (
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                  {active.children.map((child) => (
                    <li key={child.slug}>
                      <Link
                        href={`/catalog/${child.slug}`}
                        className="flex justify-between rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-700"
                      >
                        {child.name}
                        <span className="text-xs text-slate-400">{child.productCount}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">{active.productCount} ta mahsulot</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
