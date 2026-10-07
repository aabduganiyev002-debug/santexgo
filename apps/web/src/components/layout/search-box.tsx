'use client';

import type { SearchSuggestions } from '@santexgo/shared';
import { Loader2, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { ProductImage } from '@/components/product/product-image';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { formatSom } from '@/lib/format';

interface Option {
  href: string;
  label: string;
}

/**
 * Qidiruv: yozish jarayonida takliflar (mahsulotlar, brendlar, kategoriyalar),
 * Enter — barcha natijalar sahifasi. Klaviatura bilan boshqariladi (↑ ↓ Enter Esc).
 */
export function SearchBox({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(pathname === '/search' ? (searchParams.get('q') ?? '') : '');
  // Takliflar ochilgan sahifa: boshqa sahifaga o'tilganda avtomatik yopiladi
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const setOpen = (value: boolean) => setOpenedOn(value ? pathname : null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestions | null>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api<SearchSuggestions>(`/catalog/search/suggest?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then((data) => {
          setSuggestions(data);
          setActive(-1);
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const options: Option[] = suggestions
    ? [
        ...suggestions.products.map((p) => ({ href: `/products/${p.slug}`, label: p.name })),
        ...suggestions.brands.map((b) => ({ href: `/brands/${b.slug}`, label: b.name })),
        ...suggestions.categories.map((c) => ({ href: `/catalog/${c.slug}`, label: c.name })),
      ]
    : [];

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || options.length === 0) {
      if (event.key === 'ArrowDown' && options.length > 0) setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      setOpen(false);
      router.push(options[active]!.href);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const showPanel = open && query.trim().length >= 2 && suggestions !== null;
  // Har bir taklifning umumiy ro'yxatdagi tartib raqami (klaviatura bilan tanlash uchun)
  const brandOffset = suggestions?.products.length ?? 0;
  const categoryOffset = brandOffset + (suggestions?.brands.length ?? 0);
  const optionProps = (href: string, index: number) => {
    return {
      id: `${listId}-${index}`,
      role: 'option' as const,
      'aria-selected': active === index,
      href,
      onMouseEnter: () => setActive(index),
      onClick: () => setOpen(false),
      className: cn(
        'flex items-center gap-3 px-3 py-2',
        active === index ? 'bg-brand-50' : 'hover:bg-slate-50',
      ),
    };
  };

  return (
    <div className={cn('relative', className)}>
      <form role="search" onSubmit={submit} className="relative">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Mahsulot qidirish
        </label>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          inputMode="search"
          autoComplete="off"
          autoFocus={autoFocus}
          enterKeyHint="search"
          placeholder="Masalan: Plastherm 25 PN20"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-11 pr-24 text-[15px] placeholder:text-slate-400 focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/20 [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />
          ) : null}
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700"
              aria-label="Tozalash"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="submit"
            className="hidden h-8 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 sm:block"
          >
            Qidirish
          </button>
        </div>
      </form>

      {showPanel ? (
        <div
          id={`${listId}-list`}
          role="listbox"
          aria-label="Qidiruv takliflari"
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-[var(--shadow-pop)]"
        >
          {options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              Hech narsa topilmadi. Boshqacha yozib ko‘ring.
            </p>
          ) : null}
          {suggestions!.products.map((product, i) => (
            <Link key={product.id} {...optionProps(`/products/${product.slug}`, i)}>
              <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-white p-0.5">
                <ProductImage image={product.image} alt={product.name} sizes="44px" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-800">{product.name}</span>
                <span className="text-xs text-slate-500">{product.sku}</span>
              </span>
              <span
                className={cn(
                  'tabular shrink-0 text-sm font-bold',
                  product.price.discountPercent > 0 && 'text-sale',
                )}
              >
                {formatSom(product.price.current)}
              </span>
            </Link>
          ))}
          {suggestions!.brands.length > 0 ? (
            <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase text-slate-400">
              Brendlar
            </p>
          ) : null}
          {suggestions!.brands.map((brand, i) => (
            <Link key={brand.slug} {...optionProps(`/brands/${brand.slug}`, brandOffset + i)}>
              <span className="text-sm font-medium">{brand.name}</span>
            </Link>
          ))}
          {suggestions!.categories.length > 0 ? (
            <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase text-slate-400">
              Kategoriyalar
            </p>
          ) : null}
          {suggestions!.categories.map((category, i) => (
            <Link
              key={category.slug}
              {...optionProps(`/catalog/${category.slug}`, categoryOffset + i)}
            >
              <span className="text-sm">{category.name}</span>
            </Link>
          ))}
          {options.length > 0 ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit()}
              className="mt-1 w-full border-t border-slate-100 px-3 pt-2.5 text-left text-sm font-semibold text-brand-700 hover:underline"
            >
              “{query.trim()}” bo‘yicha barcha natijalar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
