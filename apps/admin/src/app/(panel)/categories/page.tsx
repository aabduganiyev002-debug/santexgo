import type { Metadata } from 'next';
import { CategoriesPage } from '@/components/catalog/categories-page';

export const metadata: Metadata = { title: 'Kategoriyalar' };

export default function Page() {
  return <CategoriesPage />;
}
