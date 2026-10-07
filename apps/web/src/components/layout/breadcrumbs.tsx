import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { SITE_URL } from '@/lib/config';

export interface Crumb {
  href: string;
  label: string;
}

/** Yo'l ko'rsatkich + Google uchun tuzilgan ma'lumot (BreadcrumbList). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all = [{ href: '/', label: 'Bosh sahifa' }, ...items];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: `${SITE_URL}${item.href}`,
    })),
  };
  return (
    <nav aria-label="Yo‘l" className="overflow-x-auto">
      <ol className="flex items-center gap-1 whitespace-nowrap text-sm text-slate-500">
        {all.map((item, index) => (
          <li key={item.href} className="flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
            ) : null}
            {index === all.length - 1 ? (
              <span aria-current="page" className="text-slate-700">
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-brand-700">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </nav>
  );
}
