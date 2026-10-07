import type { Metadata } from 'next';
import { OrderDetail } from '@/components/orders/order-detail';

export async function generateMetadata({
  params,
}: PageProps<'/orders/[number]'>): Promise<Metadata> {
  return { title: decodeURIComponent((await params).number) };
}

export default async function OrderPage({ params }: PageProps<'/orders/[number]'>) {
  const { number } = await params;
  return <OrderDetail number={decodeURIComponent(number)} />;
}
