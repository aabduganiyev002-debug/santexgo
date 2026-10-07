import type { ImageUrls } from '@santexgo/shared';
import { cn } from '@santexgo/ui/cn';

interface ProductImageProps {
  image: ImageUrls | null;
  alt: string;
  /** Brauzerga qaysi o'lcham kerakligini aytadi (srcset tanlovi uchun) */
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * Mahsulot rasmi: API tayyorlagan 3 o'lchamdan (400/800/1600 px) brauzer keraklisini tanlaydi.
 * Rasm yo'q bo'lsa — neytral belgi.
 */
export function ProductImage({
  image,
  alt,
  sizes = '(min-width: 1024px) 25vw, 50vw',
  priority,
  className,
}: ProductImageProps) {
  if (!image) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-slate-50 text-slate-300',
          className,
        )}
      >
        <svg viewBox="0 0 64 64" className="h-1/3 w-1/3" fill="none" aria-hidden="true">
          <rect x="6" y="26" width="52" height="12" rx="3" stroke="currentColor" strokeWidth="3" />
          <path
            d="M14 26v12M50 26v12M24 20h16v6H24zM24 38h16v6H24z"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
        <span className="sr-only">{alt}</span>
      </div>
    );
  }
  return (
    // Rasmlar API'da optimallashtirilgan (WebP, 3 o'lcham) — next/image kerak emas
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.medium}
      srcSet={`${image.thumb} 400w, ${image.medium} 800w, ${image.url} 1600w`}
      sizes={sizes}
      alt={image.alt ?? alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={cn('h-full w-full object-contain', className)}
    />
  );
}
