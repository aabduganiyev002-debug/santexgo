import Link from 'next/link';
import { cn } from '@/lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M16 6.5c-3.7 4.3-6.5 8-6.5 11.4a6.5 6.5 0 0 0 13 0C22.5 14.5 19.7 10.8 16 6.5Z"
        fill="#fff"
      />
      <path
        d="M13 18.5a3 3 0 0 0 3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn('inline-flex items-center gap-2 text-brand-600', className)}
      aria-label="SantexGo — bosh sahifa"
    >
      <LogoMark className="h-8 w-8" />
      <span className="text-xl font-extrabold tracking-tight text-slate-900">
        Santex<span className="text-brand-600">Go</span>
      </span>
    </Link>
  );
}
