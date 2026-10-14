import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MyOrders } from '@/components/account/my-orders';

export const metadata: Metadata = { title: 'Buyurtmalarim' };

export default function OrdersPage() {
  return (
    <Suspense>
      <MyOrders />
    </Suspense>
  );
}
