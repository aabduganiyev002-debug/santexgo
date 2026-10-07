import type { SitemapData } from '@santexgo/shared';
import type { MetadataRoute } from 'next';
import { serverGet } from '@/lib/api/server';
import { SITE_URL } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await serverGet<SitemapData>('/catalog/sitemap', { revalidate: 3600 }).catch(
    () => null,
  );
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/catalog`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/brands`, changeFrequency: 'weekly', priority: 0.7 },
  ];
  if (!data) return pages;
  return [
    ...pages,
    ...data.categories.map((c) => ({
      url: `${SITE_URL}/catalog/${c.slug}`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...data.brands.map((b) => ({
      url: `${SITE_URL}/brands/${b.slug}`,
      lastModified: b.updatedAt,
      priority: 0.7,
    })),
    ...data.products.map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified: p.updatedAt,
      priority: 0.6,
    })),
  ];
}
