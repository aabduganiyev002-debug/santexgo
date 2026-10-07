import type { Metadata } from 'next';
import { TaxonomyPage } from '@/components/catalog/taxonomy-page';

export const metadata: Metadata = { title: 'Materiallar va xususiyatlar' };

export default function Page() {
  return <TaxonomyPage />;
}
