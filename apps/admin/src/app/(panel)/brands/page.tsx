import type { Metadata } from 'next';
import { BrandsPage } from '@/components/catalog/brands-page';

export const metadata: Metadata = { title: 'Brendlar' };

export default function Page() {
  return <BrandsPage />;
}
