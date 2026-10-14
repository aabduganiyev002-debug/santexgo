import type { Metadata } from 'next';
import { FavoritesList } from '@/components/account/favorites-list';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';

export const metadata: Metadata = { title: 'Sevimlilar', robots: { index: false } };

export default function Favorites() {
  return (
    <div className="container-page py-4 sm:py-6">
      <Breadcrumbs items={[{ href: '/favorites', label: 'Sevimlilar' }]} />
      <h1 className="mb-4 mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Sevimlilar</h1>
      <FavoritesList />
    </div>
  );
}
