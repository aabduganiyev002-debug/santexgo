import { Toaster } from '@santexgo/ui/toaster';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'SantexGo Admin', template: '%s — SantexGo Admin' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0f172a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <body className="min-h-dvh bg-slate-100">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
