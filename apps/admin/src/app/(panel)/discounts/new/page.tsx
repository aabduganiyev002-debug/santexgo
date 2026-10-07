import type { Metadata } from 'next';
import { DiscountEditor } from '@/components/discounts/discount-editor';

export const metadata: Metadata = { title: 'Yangi chegirma' };

export default function Page() {
  return <DiscountEditor id={null} />;
}
