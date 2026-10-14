import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog/catalog-view';
import { normalizeSearchParams } from '@/lib/catalog-url';

export async function generateMetadata(props: PageProps<'/search'>): Promise<Metadata> {
  const { q } = normalizeSearchParams(await props.searchParams);
  return { title: q ? `“${q}” — qidiruv` : 'Qidiruv', robots: { index: false } };
}

export default async function SearchPage(props: PageProps<'/search'>) {
  const params = normalizeSearchParams(await props.searchParams);
  const q = params.q?.trim() ?? '';
  return (
    <CatalogView
      basePath="/search"
      params={params}
      title={q ? `“${q}” bo‘yicha natijalar` : 'Qidiruv'}
      breadcrumbs={[{ href: '/search', label: 'Qidiruv' }]}
    />
  );
}
