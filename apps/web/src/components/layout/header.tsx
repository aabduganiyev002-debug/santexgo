import type { CategoryNode, SiteSettings } from '@santexgo/shared';
import { formatUzPhone } from '@santexgo/shared';
import { Clock, Phone } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { CatalogMenu } from './catalog-menu';
import { HeaderActions } from './header-actions';
import { Logo } from './logo';
import { SearchBox } from './search-box';

const NAV_LINKS = [
  { href: '/brands', label: 'Brendlar' },
  { href: '/catalog?onSale=1&sort=discount', label: 'Chegirmalar', accent: true },
  { href: '/catalog?sort=new', label: 'Yangi mahsulotlar' },
];

export function Header({
  categories,
  settings,
}: {
  categories: CategoryNode[];
  settings: SiteSettings;
}) {
  const phone = settings.store.phone;
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      {phone || settings.store.workingHours ? (
        <div className="hidden border-b border-slate-100 bg-slate-50 lg:block">
          <div className="container-page flex h-9 items-center justify-end gap-6 text-xs text-slate-600">
            {settings.store.workingHours ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {settings.store.workingHours}
              </span>
            ) : null}
            {phone ? (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-800 hover:text-brand-700"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {formatUzPhone(phone)}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="container-page flex h-16 items-center gap-3 lg:h-[72px] lg:gap-4">
        <Logo className="shrink-0" />
        <CatalogMenu categories={categories} />
        <Suspense
          fallback={<div className="hidden h-11 flex-1 rounded-xl bg-slate-100 md:block" />}
        >
          <SearchBox className="hidden flex-1 md:block" />
        </Suspense>
        <div className="ml-auto md:ml-0">
          <HeaderActions />
        </div>
      </div>

      {/* Telefonda qidiruv sarlavha ostida, doim ko'rinib turadi */}
      <div className="container-page pb-3 md:hidden">
        <Suspense fallback={<div className="h-11 rounded-xl bg-slate-100" />}>
          <SearchBox />
        </Suspense>
      </div>

      <nav aria-label="Asosiy bo‘limlar" className="hidden border-t border-slate-100 lg:block">
        <ul className="container-page flex h-11 items-center gap-1 overflow-x-auto text-sm">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={
                  link.accent
                    ? 'rounded-lg px-3 py-2 font-semibold text-sale hover:bg-sale-soft'
                    : 'rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100'
                }
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="mx-2 h-5 w-px bg-slate-200" aria-hidden="true" />
          {categories.slice(0, 6).map((category) => (
            <li key={category.slug}>
              <Link
                href={`/catalog/${category.slug}`}
                className="whitespace-nowrap rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
