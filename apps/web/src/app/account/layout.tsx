import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AccountNav } from '@/components/account/account-nav';

export const metadata: Metadata = {
  title: { default: 'Shaxsiy kabinet', template: '%s — Shaxsiy kabinet' },
  robots: { index: false },
};

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-page grid grid-cols-1 gap-4 py-4 sm:py-6 lg:grid-cols-[240px_1fr] lg:gap-8">
      <aside className="min-w-0">
        <AccountNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
