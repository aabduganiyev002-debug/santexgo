import type { Metadata } from 'next';
import { ProductEditor } from '@/components/products/product-editor';

export const metadata: Metadata = { title: 'Mahsulot' };

export default async function ProductPage({ params }: PageProps<'/products/[id]'>) {
  const { id } = await params;
  return <ProductEditor id={id} />;
}
