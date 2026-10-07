import type { BrandDetail } from '@santexgo/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CatalogView } from '@/components/catalog/catalog-view';
import { serverGet } from '@/lib/api/server';
import { normalizeSearchParams, toQueryString } from '@/lib/catalog-url';
import { cn } from '@santexgo/ui/cn';

async function getBrand(slug: string) {
  return serverGet<BrandDetail>(`/catalog/brands/${encodeURIComponent(slug)}`, { revalidate: 300 });
}

export async function generateMetadata(props: PageProps<'/brands/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const brand = await getBrand(slug);
  return {
    title: `${brand.name} mahsulotlari`,
    description:
      brand.description ??
      `${brand.name}: ${brand.productCount} ta mahsulot — trubalar, fittinglar va boshqalar.`,
    alternates: { canonical: `/brands/${brand.slug}` },
  };
}

export default async function BrandPage(props: PageProps<'/brands/[slug]'>) {
  const { slug } = await props.params;
  const params = normalizeSearchParams(await props.searchParams);
  delete params.brand;
  const brand = await getBrand(slug);
  const basePath = `/brands/${brand.slug}`;

  // Brend bo'limlari: PPR TRUBA, PPR FITTING, PVC TRUBA... (shu brendda mahsuloti borlari)
  const sectionActive = (filter: BrandDetail['sections'][number]['filter']) =>
    (filter.category ?? undefined) === params.category &&
    (filter.material ?? undefined) === params.material;

  const intro = (
    <div className="space-y-4">
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={brand.name} className="h-16 w-40 object-contain" />
        ) : null}
        <div className="space-y-1 text-sm text-slate-600">
          {brand.country ? <p>Ishlab chiqaruvchi mamlakat: {brand.country}</p> : null}
          {brand.description ? <p className="max-w-3xl leading-6">{brand.description}</p> : null}
        </div>
      </div>
      {brand.sections.length > 0 ? (
        <ul className="scroll-row" aria-label={`${brand.name} bo‘limlari`}>
          <li>
            <Link
              href={basePath}
              className={cn(
                'inline-flex h-10 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold',
                !params.category && !params.material
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-brand-600',
              )}
            >
              Hammasi · {brand.productCount}
            </Link>
          </li>
          {brand.sections.map((section) => (
            <li key={section.slug}>
              <Link
                href={`${basePath}${toQueryString({
                  category: section.filter.category ?? undefined,
                  material: section.filter.material ?? undefined,
                })}`}
                className={cn(
                  'inline-flex h-10 items-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold uppercase',
                  sectionActive(section.filter)
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-brand-600',
                )}
              >
                {section.title} · {section.productCount}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  return (
    <CatalogView
      basePath={basePath}
      params={params}
      fixed={{ brand: brand.slug }}
      title={brand.name}
      breadcrumbs={[
        { href: '/brands', label: 'Brendlar' },
        { href: basePath, label: brand.name },
      ]}
      intro={intro}
    />
  );
}
