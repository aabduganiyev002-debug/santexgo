'use client';

import type { AdminProductDetail, AdminProductImage } from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Button } from '@santexgo/ui/button';
import { cn } from '@santexgo/ui/cn';
import { toast } from '@santexgo/ui/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { type ReactNode, useRef } from 'react';

const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024;

/** Rasmlar: yuklash (bir nechtasi birdan), asosiy rasm, tartib, o'chirish. */
export function ProductImages({ product }: { product: AdminProductDetail }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const key = ['admin', 'products', 'detail', product.id];
  const setImages = (images: AdminProductImage[]) => {
    queryClient.setQueryData<AdminProductDetail>(key, (old) => (old ? { ...old, images } : old));
    void queryClient.invalidateQueries({ queryKey: ['admin', 'products', 'list'] });
  };
  const onError = (error: unknown) => toast.error(errorMessage(error));

  const upload = useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      for (const file of files) form.append('files', file);
      return api<AdminProductImage[]>(`/admin/products/${product.id}/images`, {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: (images) => {
      setImages(images);
      toast.success('Rasmlar yuklandi');
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, isMain }: { id: string; isMain: boolean }) =>
      api<AdminProductImage[]>(`/admin/products/${product.id}/images/${id}`, {
        method: 'PATCH',
        body: { isMain },
      }),
    onSuccess: setImages,
    onError,
  });
  const reorder = useMutation({
    mutationFn: (imageIds: string[]) =>
      api<AdminProductImage[]>(`/admin/products/${product.id}/images/order`, {
        method: 'PUT',
        body: { imageIds },
      }),
    onSuccess: setImages,
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api<AdminProductImage[]>(`/admin/products/${product.id}/images/${id}`, { method: 'DELETE' }),
    onSuccess: setImages,
    onError,
  });

  const images = product.images;
  const move = (index: number, delta: number) => {
    const ids = images.map((i) => i.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved!);
    reorder.mutate(ids);
  };
  const busy = upload.isPending || update.isPending || reorder.isPending || remove.isPending;

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Rasmlar</h2>
        <span className="text-xs text-slate-500">JPG, PNG, WebP · 10 MB gacha</span>
      </div>
      {images.length > 0 ? (
        <ul className={cn('grid grid-cols-3 gap-2', busy && 'opacity-60')}>
          {images.map((image, index) => (
            <li
              key={image.id}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-lg border bg-white',
                image.isMain ? 'border-brand-600 ring-1 ring-brand-600' : 'border-slate-200',
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan WebP rasm */}
              <img
                src={image.thumb}
                alt={image.alt ?? ''}
                className="h-full w-full object-contain"
              />
              {image.isMain ? (
                <span className="absolute left-1 top-1 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Asosiy
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-slate-900/70 p-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <IconButton
                  label="Chapga"
                  disabled={index === 0 || busy}
                  onClick={() => move(index, -1)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </IconButton>
                {!image.isMain ? (
                  <IconButton
                    label="Asosiy qilish"
                    disabled={busy}
                    onClick={() => update.mutate({ id: image.id, isMain: true })}
                  >
                    <Star className="h-3.5 w-3.5" />
                  </IconButton>
                ) : null}
                <IconButton
                  label="O‘chirish"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Rasm o‘chirilsinmi?')) remove.mutate(image.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton
                  label="O‘ngga"
                  disabled={index === images.length - 1 || busy}
                  onClick={() => move(index, 1)}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          Rasm yo‘q. Mahsulot rasmi sotuvga kuchli ta’sir qiladi — oq fonda, aniq rasm yuklang.
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length === 0) return;
          if (files.length > MAX_FILES) {
            toast.error(`Bir martada ${MAX_FILES} tagacha rasm yuklash mumkin`);
            return;
          }
          const big = files.find((f) => f.size > MAX_BYTES);
          if (big) {
            toast.error(`${big.name}: 10 MB dan katta`);
            return;
          }
          upload.mutate(files);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        loading={upload.isPending}
        onClick={() => input.current?.click()}
      >
        <ImagePlus className="h-4 w-4" aria-hidden="true" />
        Rasm yuklash
      </Button>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
