import type { BrandSummary } from '@santexgo/shared';
import type { Metadata } from 'next';
import { BrandCard } from '@/components/home/brand-strip';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { serverGet } from '@/lib/api/server';

export const metadata: Metadata = {
  title: 'Brendlar',
  description:
    'Santexnika brendlari: Plastherm, Vero va boshqalar. Brend bo‘yicha mahsulotlarni tanlang.',
  alternates: { canonical: '/brands' },
};

export default async function BrandsPage() {
  const brands = await serverGet<BrandSummary[]>('/catalog/brands', { revalidate: 300 });
  return (
    <div className="container-page space-y-4 py-4 sm:py-6">
      <Breadcrumbs items={[{ href: '/brands', label: 'Brendlar' }]} />
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Brendlar</h1>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {brands.map((brand) => (
          <li key={brand.slug}>
            <BrandCard brand={brand} />
          </li>
        ))}
      </ul>
    </div>
  );
}
