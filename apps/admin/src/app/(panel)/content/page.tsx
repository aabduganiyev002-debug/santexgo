import type { Metadata } from 'next';
import { ContentPage } from '@/components/content/content-page';

export const metadata: Metadata = { title: 'Bannerlar va bosh sahifa' };

export default function Page() {
  return <ContentPage />;
}
