import type { Metadata } from 'next';
import { CustomerDetail } from '@/components/customers/customer-detail';

export const metadata: Metadata = { title: 'Mijoz' };

export default async function Page({ params }: PageProps<'/customers/[id]'>) {
  const { id } = await params;
  return <CustomerDetail id={id} />;
}
