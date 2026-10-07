import type { CategoryDetail } from '@santexgo/shared';
import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog/catalog-view';
import { serverGet } from '@/lib/api/server';
import { normalizeSearchParams } from '@/lib/catalog-url';

async function getCategory(slug: string) {
  return serverGet<CategoryDetail>(`/catalog/categories/${encodeURIComponent(slug)}`, {
    revalidate: 300,
  });
}

export async function generateMetadata(props: PageProps<'/catalog/[category]'>): Promise<Metadata> {
  const { category: slug } = await props.params;
  const category = await getCategory(slug);
  return {
    title: category.name,
    description:
      category.description ??
      `${category.name} — ${category.productCount} ta mahsulot. Narxlar, chegirmalar va yetkazib berish.`,
    alternates: { canonical: `/catalog/${category.slug}` },
  };
}

export default async function CategoryPage(props: PageProps<'/catalog/[category]'>) {
  const { category: slug } = await props.params;
  const params = normalizeSearchParams(await props.searchParams);
  delete params.category;
  const category = await getCategory(slug);
  return (
    <CatalogView
      basePath={`/catalog/${category.slug}`}
      params={params}
      fixed={{ category: category.slug }}
      title={category.name}
    />
  );
}
