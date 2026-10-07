import type { Metadata } from 'next';
import { DiscountsList } from '@/components/discounts/discounts-list';

export const metadata: Metadata = { title: 'Chegirmalar' };

export default function Page() {
  return <DiscountsList />;
}
