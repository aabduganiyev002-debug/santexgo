'use client';

import type { BannerInfo } from '@santexgo/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@santexgo/ui/cn';

const AUTOPLAY_MS = 6000;

/** Bosh sahifa slayderi: avtomatik almashadi, barmoq bilan suriladi, klaviatura bilan boshqariladi. */
export function BannerSlider({ banners }: { banners: BannerInfo[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = banners.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [count, paused]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Aksiyalar"
      className="relative overflow-hidden rounded-2xl bg-slate-200"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        if (start !== null && end !== undefined && Math.abs(end - start) > 40)
          go(index + (end < start ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((banner, i) => {
          const image = (
            <picture>
              {banner.mobileImageUrl ? (
                <source media="(max-width: 767px)" srcSet={banner.mobileImageUrl} />
              ) : null}
              <img
                src={banner.imageUrl}
                alt={banner.title ?? 'Aksiya'}
                className="aspect-[16/9] w-full object-cover sm:aspect-[21/8]"
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
              />
            </picture>
          );
          return (
            <div
              key={banner.id}
              className="relative w-full shrink-0"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${count}`}
              aria-hidden={i !== index}
            >
              {banner.linkUrl ? (
                <Link href={banner.linkUrl} tabIndex={i === index ? 0 : -1}>
                  {image}
                </Link>
              ) : (
                image
              )}
              {banner.title ? (
                <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/50 via-black/10 to-transparent p-5 sm:items-center sm:bg-gradient-to-r sm:p-10">
                  <div className="max-w-md text-white">
                    <p className="text-xl font-extrabold leading-tight sm:text-4xl">
                      {banner.title}
                    </p>
                    {banner.subtitle ? (
                      <p className="mt-2 text-sm text-white/90 sm:text-lg">{banner.subtitle}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow hover:bg-white sm:flex"
            aria-label="Oldingi"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow hover:bg-white sm:flex"
            aria-label="Keyingi"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`${i + 1}-slayd`}
                aria-current={i === index}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === index ? 'w-6 bg-white' : 'w-2 bg-white/60',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
