import { type ReactNode, Suspense } from 'react';
import { AdminShell } from '@/components/shell/admin-shell';

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell>
      {/* Sahifalar URL parametrlaridan (filtrlar) foydalanadi */}
      <Suspense>{children}</Suspense>
    </AdminShell>
  );
}
