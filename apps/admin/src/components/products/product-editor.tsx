'use client';

import type { AdminProductDetail, DeleteResult } from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Badge } from '@santexgo/ui/badge';
import { Button } from '@santexgo/ui/button';
import { toast } from '@santexgo/ui/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ExternalLink, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ErrorState, TableSkeleton } from '@/components/data/states';
import { PageHeader } from '@/components/page-header';
import { SITE_URL } from '@/lib/config';
import { ProductDocuments } from './product-documents';
import { ProductForm } from './product-form';
import { ProductImages } from './product-images';
import { ProductStock, StockMovements } from './product-stock';

export function ProductEditor({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = ['admin', 'products', 'detail', id];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api<AdminProductDetail>(`/admin/products/${id}`),
  });

  const remove = useMutation({
    mutationFn: () => api<DeleteResult>(`/admin/products/${id}`, { method: 'DELETE' }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      if (result.result === 'deleted') {
        toast.success('Mahsulot o‘chirildi');
        router.replace('/products');
      } else {
        toast.info('Mahsulot buyurtmalarda bor — arxivlandi (saytda ko‘rinmaydi)');
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const restore = useMutation({
    mutationFn: () => api<AdminProductDetail>(`/admin/products/${id}/restore`, { method: 'POST' }),
    onSuccess: (product) => {
      queryClient.setQueryData(key, product);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'products', 'list'] });
      toast.success('Mahsulot yana saytda');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (query.isPending) return <TableSkeleton rows={10} />;
  if (query.error) return <ErrorState error={query.error} />;
  const product = query.data;

  return (
    <div>
      <PageHeader
        back={{ href: '/products', label: 'Mahsulotlar' }}
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>SKU {product.sku}</span>
            {product.isActive ? <Badge tone="success">Faol</Badge> : <Badge>Arxivda</Badge>}
            {product.appliedDiscount ? (
              <Badge tone="sale">Chegirma: {product.appliedDiscount.name}</Badge>
            ) : null}
          </span>
        }
        actions={
          <>
            {product.isActive ? (
              <a
                href={`${SITE_URL}/products/${product.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Saytda
              </a>
            ) : null}
            {product.isActive ? (
              <Button
                variant="ghostDanger"
                size="sm"
                loading={remove.isPending}
                onClick={() => {
                  const message = product.hasOrders
                    ? 'Mahsulot buyurtmalarda bor — arxivlanadi (saytdan yashiriladi). Davom etilsinmi?'
                    : 'Mahsulot butunlay o‘chirilsinmi? Bu amalni qaytarib bo‘lmaydi.';
                  if (window.confirm(message)) remove.mutate();
                }}
              >
                {product.hasOrders ? (
                  <Archive className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {product.hasOrders ? 'Arxivlash' : 'O‘chirish'}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                loading={restore.isPending}
                onClick={() => restore.mutate()}
              >
                <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                Arxivdan qaytarish
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
        <div className="min-w-0">
          {/* Mahsulot o'zgarganda forma yangi qiymatlar bilan qayta yaratiladi */}
          <ProductForm key={product.updatedAt} product={product} />
        </div>
        <div className="space-y-4">
          <ProductImages product={product} />
          <ProductStock product={product} />
          <ProductDocuments product={product} />
        </div>
      </div>
      <StockMovements productId={product.id} />
    </div>
  );
}
