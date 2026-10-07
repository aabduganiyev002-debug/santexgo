'use client';

import { type CatalogParams, setParam, SORT_OPTIONS } from '@/lib/catalog-url';
import { useCatalogNavigation } from './use-catalog-navigation';

export function SortSelect({
  params: serverParams,
  hasQuery,
}: {
  params: CatalogParams;
  hasQuery: boolean;
}) {
  const { navigate, params } = useCatalogNavigation(serverParams);
  const options = hasQuery
    ? [{ value: 'relevance', label: 'Mosligi bo‘yicha' }, ...SORT_OPTIONS]
    : SORT_OPTIONS;
  const current = params.sort ?? (hasQuery ? 'relevance' : 'popular');
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="hidden text-slate-500 sm:inline">Saralash:</span>
      <select
        value={current}
        onChange={(e) => navigate(setParam(params, 'sort', e.target.value))}
        className="h-10 rounded-xl border border-slate-300 bg-white pl-3 pr-8 text-sm font-medium focus:border-brand-600 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
