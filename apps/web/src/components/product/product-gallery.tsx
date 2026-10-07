'use client';

import type { ImageUrls } from '@santexgo/shared';
import { useState } from 'react';
import { cn } from '@santexgo/ui/cn';
import { ProductImage } from './product-image';

/** Mahsulot rasmlari: katta rasm va kichik rasmlar ro'yxati. */
export function ProductGallery({ images, name }: { images: ImageUrls[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? null;
  return (
    <div className="space-y-3">
      <div className="card relative aspect-square overflow-hidden p-4 sm:p-8">
        <ProductImage
          image={current}
          alt={name}
          priority
          sizes="(min-width: 1024px) 560px, 100vw"
        />
      </div>
      {images.length > 1 ? (
        <ul className="scroll-row" aria-label="Rasmlar">
          {images.map((image, i) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1}-rasm`}
                aria-current={i === index}
                className={cn(
                  'h-16 w-16 overflow-hidden rounded-xl border-2 bg-white p-1 sm:h-20 sm:w-20',
                  i === index ? 'border-brand-600' : 'border-transparent hover:border-slate-300',
                )}
              >
                <ProductImage image={image} alt="" sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
