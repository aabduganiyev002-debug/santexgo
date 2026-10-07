import type { Metadata } from 'next';
import { CheckoutPage } from '@/components/checkout/checkout-page';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { getLayoutData } from '@/lib/site-data';

export const metadata: Metadata = {
  title: 'Buyurtmani rasmiylashtirish',
  robots: { index: false },
};

export default async function Checkout() {
  const { settings } = await getLayoutData();
  return (
    <div className="container-page py-4 sm:py-6">
      <Breadcrumbs
        items={[
          { href: '/cart', label: 'Savatcha' },
          { href: '/checkout', label: 'Rasmiylashtirish' },
        ]}
      />
      <h1 className="mb-4 mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
        Buyurtmani rasmiylashtirish
      </h1>
      <CheckoutPage delivery={settings.delivery} />
    </div>
  );
}
