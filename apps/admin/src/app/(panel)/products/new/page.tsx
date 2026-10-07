import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { ProductForm } from '@/components/products/product-form';

export const metadata: Metadata = { title: 'Yangi mahsulot' };

export default function NewProductPage() {
  return (
    <div className="max-w-4xl">
      <PageHeader
        back={{ href: '/products', label: 'Mahsulotlar' }}
        title="Yangi mahsulot"
        description="Saqlangandan keyin rasmlar va hujjatlarni yuklash mumkin"
      />
      <ProductForm product={null} />
    </div>
  );
}
