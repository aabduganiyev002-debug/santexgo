import type { Metadata } from 'next';
import { CustomersList } from '@/components/customers/customers-list';

export const metadata: Metadata = { title: 'Mijozlar' };

export default function Page() {
  return <CustomersList />;
}
