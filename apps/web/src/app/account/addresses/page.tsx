import type { Metadata } from 'next';
import { AddressBook } from '@/components/account/address-book';

export const metadata: Metadata = { title: 'Manzillar' };

export default function AddressesPage() {
  return <AddressBook />;
}
