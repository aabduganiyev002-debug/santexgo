import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { CartSync } from '@/components/cart/cart-sync';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Toaster } from '@/components/layout/toaster';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/config';
import { getLayoutData } from '@/lib/site-data';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — santexnika mahsulotlari online do‘koni`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: 'uz_UZ',
    siteName: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#1d63d8',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Sahifalar har so'rovda tayyorlanadi (ma'lumotlar keshdan) — build paytida API kerak emas
  await connection();
  const { categories, brands, settings } = await getLayoutData();
  return (
    <html lang="uz">
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <a
            href="#main"
            className="sr-only z-50 rounded-lg bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Asosiy qismga o‘tish
          </a>
          <Header categories={categories} settings={settings} />
          <main id="main" className="pb-safe flex-1">
            {children}
          </main>
          <Footer categories={categories} brands={brands} settings={settings} />
          <MobileNav />
          <Toaster />
          <CartSync />
        </Providers>
      </body>
    </html>
  );
}
