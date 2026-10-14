'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Sahifalar orasida o'tishda yuqorida ingichka chiziq. Umumiy loading.tsx o'rniga:
 * u sahifani Suspense ichiga olib, mavjud bo'lmagan mahsulot uchun ham 200 status
 * qaytarishga majbur qiladi (SEO uchun 404 kerak).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [shownFor, setShownFor] = useState(pathname);
  // Sahifa o'zgardi (havola, orqaga tugmasi yoki router.push) — chiziq yashiriladi
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setActive(false);
  }

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) {
        return;
      }
      setActive(true);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Javob kelmasa ham chiziq abadiy turmaydi
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setActive(false), 10_000);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active) return null;
  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-brand-100"
      role="progressbar"
      aria-label="Sahifa yuklanmoqda"
    >
      <div className="h-full w-1/3 animate-[nav-progress_1.2s_ease-in-out_infinite] bg-brand-600" />
    </div>
  );
}
