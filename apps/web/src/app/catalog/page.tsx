import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog/catalog-view';
import { normalizeSearchParams } from '@/lib/catalog-url';

export const metadata: Metadata = {
  title: 'Katalog',
  description:
    'Barcha santexnika mahsulotlari: trubalar, fittinglar, kanalizatsiya, kranlar va armatura.',
  alternates: { canonical: '/catalog' },
};

export default async function CatalogPage(props: PageProps<'/catalog'>) {
  const params = normalizeSearchParams(await props.searchParams);
  const title =
    params.onSale === '1'
      ? 'Chegirmadagi mahsulotlar'
      : params.sort === 'new'
        ? 'Yangi mahsulotlar'
        : 'Katalog';
  return <CatalogView basePath="/catalog" params={params} title={title} />;
}
