import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { CartPage } from '@/components/cart/cart-page';

export const metadata: Metadata = { title: 'Savatcha', robots: { index: false } };

export default function Cart() {
  return (
    <div className="container-page py-4 sm:py-6">
      <Breadcrumbs items={[{ href: '/cart', label: 'Savatcha' }]} />
      <h1 className="mb-4 mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Savatcha</h1>
      <CartPage />
    </div>
  );
}
