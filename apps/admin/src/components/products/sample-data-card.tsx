'use client';

import type { SampleDataRemoval, SampleDataSummary } from '@santexgo/shared';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Button } from '@santexgo/ui/button';
import { toast } from '@santexgo/ui/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';

export const SAMPLE_DATA_KEY = ['admin', 'sample-data'];

/**
 * Seed'ning namunaviy mahsulot va chegirmalari (Windows paketi, sinov serveri): haqiqiy katalog
 * yuklangach o'chiriladi — aks holda namunaviy chegirmalar haqiqiy mahsulotlarga ham tushadi.
 */
export function SampleDataCard() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SAMPLE_DATA_KEY,
    queryFn: () => api<SampleDataSummary>('/admin/catalog-import/sample-data'),
  });
  const remove = useMutation({
    mutationFn: () =>
      api<SampleDataRemoval>('/admin/catalog-import/sample-data', { method: 'DELETE' }),
    onSuccess: (result) => {
      toast.success(
        `Namunaviy ma’lumotlar o‘chirildi: ${result.productsDeleted + result.productsArchived} ta mahsulot, ` +
          `${result.discounts} ta chegirma`,
      );
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const summary = query.data;
  if (!summary || summary.products + summary.discounts === 0) return null;

  return (
    <div className="card space-y-3 border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-start gap-3">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="space-y-1 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Saytda namunaviy (sinov) ma’lumotlar bor</p>
          <p>
            Dastur bilan birga kelgan {summary.products} ta namunaviy mahsulot va{' '}
            {summary.discounts} ta namunaviy chegirma. O‘z katalogingizni yuklagach, ularni
            o‘chiring — aks holda, masalan, «Kanalizatsiya −5%» chegirmasi sizning
            mahsulotlaringizga ham tushadi.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        loading={remove.isPending}
        onClick={() => {
          if (
            window.confirm(
              'Namunaviy mahsulotlar va chegirmalar o‘chirilsinmi? Siz qo‘shgan mahsulotlarga tegilmaydi.',
            )
          ) {
            remove.mutate();
          }
        }}
      >
        Namunaviy ma’lumotlarni o‘chirish
      </Button>
    </div>
  );
}
