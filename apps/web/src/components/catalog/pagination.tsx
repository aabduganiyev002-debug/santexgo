import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { type CatalogParams, toQueryString } from '@/lib/catalog-url';
import { cn } from '@/lib/cn';

function pages(current: number, total: number): (number | '…')[] {
  const result: (number | '…')[] = [];
  const add = (page: number) => {
    if (page >= 1 && page <= total && !result.includes(page)) result.push(page);
  };
  add(1);
  if (current - 2 > 2) result.push('…');
  for (let page = current - 2; page <= current + 2; page += 1) add(page);
  if (current + 2 < total - 1) result.push('…');
  add(total);
  return result;
}

export function Pagination({
  page,
  totalPages,
  basePath,
  params,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params: CatalogParams;
}) {
  if (totalPages <= 1) return null;
  const href = (target: number) =>
    `${basePath}${toQueryString({ ...params, page: target > 1 ? String(target) : undefined })}`;
  const linkClass =
    'flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-semibold';
  return (
    <nav aria-label="Sahifalar" className="flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className={cn(
            linkClass,
            'bg-white text-slate-700 shadow-[var(--shadow-card)] hover:text-brand-700',
          )}
          aria-label="Oldingi sahifa"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : null}
      {pages(page, totalPages).map((item, index) =>
        item === '…' ? (
          <span key={`gap-${index}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={href(item)}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              linkClass,
              item === page
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-700 shadow-[var(--shadow-card)] hover:text-brand-700',
            )}
          >
            {item}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          className={cn(
            linkClass,
            'bg-white text-slate-700 shadow-[var(--shadow-card)] hover:text-brand-700',
          )}
          aria-label="Keyingi sahifa"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : null}
    </nav>
  );
}
