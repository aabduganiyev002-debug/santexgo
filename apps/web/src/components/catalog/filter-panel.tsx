'use client';

import type { AttributeFacet, CategoryFacet, FacetValue, ProductFacets } from '@santexgo/shared';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button } from '@santexgo/ui/button';
import {
  type CatalogParams,
  listValues,
  setParam,
  toggleValue,
  toQueryString,
} from '@/lib/catalog-url';
import { cn } from '@santexgo/ui/cn';
import { formatSom } from '@santexgo/ui/format';
import { useCatalogNavigation } from './use-catalog-navigation';

const COLLAPSED_LIMIT = 8;

export interface FilterPanelProps {
  facets: ProductFacets;
  params: CatalogParams;
  /** Sahifaning o'zi belgilagan filtrlar (brend sahifasida — brend) — ko'rsatilmaydi */
  fixed: readonly string[];
  /** Kategoriya havolasi: katalogda — yo'l (/catalog/slug), boshqa sahifalarda — filtr (?category=) */
  categoryLink: { mode: 'path' | 'query'; basePath: string };
}

export function categoryHref(
  link: FilterPanelProps['categoryLink'],
  params: CatalogParams,
  slug: string,
): string {
  return link.mode === 'path'
    ? `/catalog/${slug}${toQueryString({ ...params, category: undefined, page: undefined })}`
    : `${link.basePath}${toQueryString({ ...params, category: slug, page: undefined })}`;
}

/** Katalog filtrlari: har bir qiymat yonida mahsulotlar soni; o'zgarish darhol qo'llanadi. */
export function FilterPanel({
  facets,
  params: serverParams,
  fixed,
  categoryLink,
}: FilterPanelProps) {
  const { navigate, params, pending } = useCatalogNavigation(serverParams);
  const isSelected = (key: string, value: string) => listValues(params, key).includes(value);
  const withSelection = (key: string, values: FacetValue[]) =>
    values.map((v) => ({ ...v, selected: isSelected(key, v.value) }));

  return (
    <div
      className={cn('divide-y divide-slate-100 transition-opacity', pending && 'opacity-70')}
      aria-busy={pending}
    >
      {facets.categories.length > 0 ? (
        <FilterGroup title="Kategoriya">
          <CategoryLinks
            categories={facets.categories}
            href={(slug) => categoryHref(categoryLink, params, slug)}
          />
        </FilterGroup>
      ) : null}

      <FilterGroup title="Mavjudlik">
        <div className="space-y-1">
          <Toggle
            label="Sotuvda borlari"
            count={facets.inStockCount}
            checked={params.inStock === '1'}
            onChange={(checked) => navigate(setParam(params, 'inStock', checked ? '1' : undefined))}
          />
          <Toggle
            label="Chegirmadagilar"
            count={facets.onSaleCount}
            checked={params.onSale === '1'}
            onChange={(checked) => navigate(setParam(params, 'onSale', checked ? '1' : undefined))}
          />
        </div>
      </FilterGroup>

      {!fixed.includes('brand') && facets.brands.length > 0 ? (
        <FilterGroup title="Brend">
          <CheckboxList
            values={withSelection('brand', facets.brands)}
            onToggle={(v) => navigate(toggleValue(params, 'brand', v))}
          />
        </FilterGroup>
      ) : null}

      {facets.materials.length > 0 ? (
        <FilterGroup title="Material">
          <CheckboxList
            values={withSelection('material', facets.materials)}
            onToggle={(v) => navigate(toggleValue(params, 'material', v))}
          />
        </FilterGroup>
      ) : null}

      {facets.price ? (
        <FilterGroup title="Narx, so‘m">
          <PriceFilter
            key={`${params.priceMin ?? ''}-${params.priceMax ?? ''}`}
            min={facets.price.min}
            max={facets.price.max}
            params={params}
            onApply={(priceMin, priceMax) =>
              navigate({ ...params, priceMin, priceMax, page: undefined })
            }
          />
        </FilterGroup>
      ) : null}

      {facets.attributes.map((attribute) => (
        <FilterGroup key={attribute.key} title={attributeTitle(attribute)}>
          <CheckboxList
            values={withSelection(attribute.key, attribute.values)}
            unit={attribute.unit}
            onToggle={(v) => navigate(toggleValue(params, attribute.key, v))}
          />
        </FilterGroup>
      ))}
    </div>
  );
}

function attributeTitle(attribute: AttributeFacet): string {
  return attribute.unit ? `${attribute.name}, ${attribute.unit}` : attribute.name;
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="py-4 first:pt-0">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between text-left text-sm font-bold text-slate-900"
        >
          {title}
          <ChevronDown
            className={cn('h-4 w-4 text-slate-400 transition-transform', !open && '-rotate-90')}
            aria-hidden="true"
          />
        </button>
      </h3>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

function CategoryLinks({
  categories,
  href,
}: {
  categories: CategoryFacet[];
  href: (slug: string) => string;
}) {
  return (
    <ul className="space-y-0.5">
      {categories.map((category) => (
        <li key={category.slug}>
          <Link
            href={href(category.slug)}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-700"
          >
            <span className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              {category.name}
            </span>
            <span className="text-xs text-slate-400">{category.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CheckboxList({
  values,
  unit,
  onToggle,
}: {
  values: FacetValue[];
  unit?: string | null;
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hidden = values.length - COLLAPSED_LIMIT;
  // Tanlanganlari doim ko'rinadi
  const visible =
    expanded || hidden <= 0
      ? values
      : values.filter((v, index) => index < COLLAPSED_LIMIT || v.selected);
  return (
    <div>
      <ul className="space-y-0.5">
        {visible.map((value) => (
          <li key={value.value}>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50',
                value.count === 0 && !value.selected && 'opacity-50',
              )}
            >
              <input
                type="checkbox"
                checked={value.selected}
                onChange={() => onToggle(value.value)}
                className="h-4 w-4 rounded border-slate-300 accent-brand-600"
              />
              <span className="flex-1 text-slate-700">
                {value.label}
                {unit && /^\d/.test(value.label) ? ` ${unit}` : ''}
              </span>
              <span className="text-xs text-slate-400">{value.count}</span>
            </label>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 px-2 text-sm font-semibold text-brand-700 hover:underline"
        >
          {expanded ? 'Kamroq ko‘rsatish' : `Yana ${hidden} ta`}
        </button>
      ) : null}
    </div>
  );
}

function Toggle({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-brand-600"
      />
      <span className="flex-1 text-slate-700">{label}</span>
      <span className="text-xs text-slate-400">{count}</span>
    </label>
  );
}

function PriceFilter({
  min,
  max,
  params,
  onApply,
}: {
  min: number;
  max: number;
  params: CatalogParams;
  onApply: (min: string | undefined, max: string | undefined) => void;
}) {
  // URL'dagi narx o'zgarsa komponent qayta yaratiladi (key orqali) — maydonlar yangilanadi
  const [from, setFrom] = useState(params.priceMin ?? '');
  const [to, setTo] = useState(params.priceMax ?? '');

  const clean = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits ? String(Number(digits)) : undefined;
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    onApply(clean(from), clean(to));
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          aria-label="Narx, dan"
          placeholder={formatSom(min, { withCurrency: false })}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-2.5 text-sm focus:border-brand-600 focus:outline-none"
        />
        <span className="text-slate-400">—</span>
        <input
          inputMode="numeric"
          aria-label="Narx, gacha"
          placeholder={formatSom(max, { withCurrency: false })}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-10 w-full min-w-0 rounded-lg border border-slate-300 px-2.5 text-sm focus:border-brand-600 focus:outline-none"
        />
      </div>
      <Button type="submit" variant="secondary" size="sm" fullWidth>
        Qo‘llash
      </Button>
      {listValues(params, 'priceMin').length + listValues(params, 'priceMax').length > 0 ? (
        <button
          type="button"
          onClick={() => onApply(undefined, undefined)}
          className="w-full text-xs text-slate-500 hover:text-sale"
        >
          Narx filtrini olib tashlash
        </button>
      ) : null}
    </form>
  );
}
