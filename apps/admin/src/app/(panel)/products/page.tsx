import type { Metadata } from 'next';
import { ProductsList } from '@/components/products/products-list';

export const metadata: Metadata = { title: 'Mahsulotlar' };

export default function ProductsPage() {
  return <ProductsList />;
}
