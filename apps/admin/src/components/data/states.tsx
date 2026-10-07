import { Alert } from '@santexgo/ui/alert';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Skeleton } from '@santexgo/ui/skeleton';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card space-y-3 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center">
      <Inbox className="h-10 w-10 text-slate-300" aria-hidden="true" />
      <p className="font-semibold text-slate-700">{title}</p>
      {children}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return <Alert tone="error">{errorMessage(error)}</Alert>;
}
