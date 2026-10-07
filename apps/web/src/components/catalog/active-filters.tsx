'use client';

import type { ProductFacets } from '@santexgo/shared';
import { X } from 'lucide-react';
import { type CatalogParams, attributeParams, listValues, toggleValue } from '@/lib/catalog-url';
import { formatSom } from '@/lib/format';
import { useCatalogNavigation } from './use-catalog-navigation';

interface Chip {
  key: string;
  label: string;
  next: CatalogParams;
}

/** Tanlangan filtrlar "chip" ko'rinishida — bittasini yoki hammasini olib tashlash. */
export function ActiveFilters({
  facets,
  params: serverParams,
  fixed,
}: {
  facets: ProductFacets;
  params: CatalogParams;
  fixed: readonly string[];
}) {
  const { navigate, params } = useCatalogNavigation(serverParams);
  const chips: Chip[] = [];
  const label = (list: { value: string; label: string }[], value: string) =>
    list.find((v) => v.value === value)?.label ?? value;

  if (!fixed.includes('brand')) {
    for (const value of listValues(params, 'brand')) {
      chips.push({
        key: `brand-${value}`,
        label: label(facets.brands, value),
        next: toggleValue(params, 'brand', value),
      });
    }
  }
  for (const value of listValues(params, 'material')) {
    chips.push({
      key: `material-${value}`,
      label: label(facets.materials, value),
      next: toggleValue(params, 'material', value),
    });
  }
  for (const [key, values] of attributeParams(params)) {
    if (fixed.includes(key)) continue;
    const facet = facets.attributes.find((a) => a.key === key);
    for (const value of values) {
      const text = facet
        ? `${facet.name}: ${value}${facet.unit && /^\d/.test(value) ? ` ${facet.unit}` : ''}`
        : value;
      chips.push({ key: `${key}-${value}`, label: text, next: toggleValue(params, key, value) });
    }
  }
  if (params.priceMin || params.priceMax) {
    const from = params.priceMin
      ? `${formatSom(Number(params.priceMin), { withCurrency: false })} dan`
      : '';
    const to = params.priceMax
      ? `${formatSom(Number(params.priceMax), { withCurrency: false })} gacha`
      : '';
    chips.push({
      key: 'price',
      label: `Narx: ${[from, to].filter(Boolean).join(' ')}`,
      next: { ...params, priceMin: undefined, priceMax: undefined, page: undefined },
    });
  }
  if (params.inStock === '1') {
    chips.push({
      key: 'inStock',
      label: 'Sotuvda borlari',
      next: { ...params, inStock: undefined, page: undefined },
    });
  }
  if (params.onSale === '1') {
    chips.push({
      key: 'onSale',
      label: 'Chegirmadagilar',
      next: { ...params, onSale: undefined, page: undefined },
    });
  }

  if (chips.length === 0) return null;

  const cleared: CatalogParams = {};
  for (const key of ['q', 'sort', ...fixed]) {
    if (params[key]) cleared[key] = params[key];
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => navigate(chip.next)}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1.5 pl-3 pr-2 text-sm font-medium text-brand-800 hover:bg-brand-100"
        >
          {chip.label}
          <X className="h-3.5 w-3.5" aria-label="olib tashlash" />
        </button>
      ))}
      {chips.length > 1 ? (
        <button
          type="button"
          onClick={() => navigate(cleared)}
          className="px-2 text-sm font-semibold text-slate-500 hover:text-sale"
        >
          Hammasini tozalash
        </button>
      ) : null}
    </div>
  );
}
