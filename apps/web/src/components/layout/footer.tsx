import type { BrandSummary, CategoryNode, SiteSettings } from '@santexgo/shared';
import { formatUzPhone } from '@santexgo/shared';
import Link from 'next/link';
import { SITE_DESCRIPTION } from '@/lib/config';
import { Logo } from './logo';

export function Footer({
  categories,
  brands,
  settings,
}: {
  categories: CategoryNode[];
  brands: BrandSummary[];
  settings: SiteSettings;
}) {
  const { store } = settings;
  const hasContacts = Boolean(
    store.phone ||
    store.phone2 ||
    store.workingHours ||
    store.address ||
    store.email ||
    store.telegram,
  );
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm leading-6 text-slate-600">{SITE_DESCRIPTION}</p>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">Katalog</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {categories.slice(0, 8).map((c) => (
              <li key={c.slug}>
                <Link href={`/catalog/${c.slug}`} className="text-slate-600 hover:text-brand-700">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">Brendlar</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {brands.slice(0, 8).map((b) => (
              <li key={b.slug}>
                <Link href={`/brands/${b.slug}`} className="text-slate-600 hover:text-brand-700">
                  {b.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/brands" className="font-semibold text-brand-700 hover:underline">
                Barcha brendlar
              </Link>
            </li>
          </ul>
        </div>

        {hasContacts ? (
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">Aloqa</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {store.phone ? (
                <li>
                  <a
                    href={`tel:${store.phone}`}
                    className="text-base font-bold text-slate-900 hover:text-brand-700"
                  >
                    {formatUzPhone(store.phone)}
                  </a>
                </li>
              ) : null}
              {store.phone2 ? (
                <li>
                  <a href={`tel:${store.phone2}`} className="hover:text-brand-700">
                    {formatUzPhone(store.phone2)}
                  </a>
                </li>
              ) : null}
              {store.workingHours ? <li>{store.workingHours}</li> : null}
              {store.address ? <li>{store.address}</li> : null}
              {store.email ? (
                <li>
                  <a href={`mailto:${store.email}`} className="hover:text-brand-700">
                    {store.email}
                  </a>
                </li>
              ) : null}
              {store.telegram ? (
                <li>
                  <a
                    href={
                      store.telegram.startsWith('http')
                        ? store.telegram
                        : `https://t.me/${store.telegram.replace(/^@/, '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand-700"
                  >
                    Telegram
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="border-t border-slate-100">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-slate-500 sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {store.name}. Barcha huquqlar himoyalangan.
          </p>
          <p>Narxlar so‘mda, QQS bilan.</p>
        </div>
      </div>
    </footer>
  );
}
