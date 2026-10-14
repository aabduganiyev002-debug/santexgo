import type { Metadata } from 'next';
import { OrderDetail } from '@/components/account/order-detail';

export async function generateMetadata({
  params,
}: PageProps<'/account/orders/[number]'>): Promise<Metadata> {
  const { number } = await params;
  return { title: decodeURIComponent(number) };
}

export default async function OrderPage({ params }: PageProps<'/account/orders/[number]'>) {
  const { number } = await params;
  return <OrderDetail number={decodeURIComponent(number)} />;
}
