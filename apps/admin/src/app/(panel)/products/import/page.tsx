import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { CatalogImport } from '@/components/products/catalog-import';

export const metadata: Metadata = { title: 'Katalogni yuklash' };

export default function CatalogImportPage() {
  return (
    <div>
      <PageHeader
        back={{ href: '/products', label: 'Mahsulotlar' }}
        title="Katalogni yuklash"
        description="Mahsulotlar, narxlar va rasmlar bitta fayldan — bir yo‘la"
      />
      <CatalogImport />
    </div>
  );
}
