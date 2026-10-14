import type { Metadata } from 'next';
import { DiscountEditor } from '@/components/discounts/discount-editor';

export const metadata: Metadata = { title: 'Chegirma' };

export default async function Page({ params }: PageProps<'/discounts/[id]'>) {
  const { id } = await params;
  return <DiscountEditor id={id} />;
}
