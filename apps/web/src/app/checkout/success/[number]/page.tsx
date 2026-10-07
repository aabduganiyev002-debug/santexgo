import type { Metadata } from 'next';
import { OrderSuccess } from '@/components/checkout/order-success';
import { getLayoutData } from '@/lib/site-data';

export const metadata: Metadata = { title: 'Buyurtma qabul qilindi', robots: { index: false } };

export default async function OrderSuccessPage({
  params,
}: PageProps<'/checkout/success/[number]'>) {
  const { number } = await params;
  const { settings } = await getLayoutData();
  return (
    <div className="container-page max-w-3xl py-6 sm:py-10">
      <OrderSuccess number={decodeURIComponent(number)} storePhone={settings.store.phone ?? null} />
    </div>
  );
}
