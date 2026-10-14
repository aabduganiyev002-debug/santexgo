'use client';

import type { AdminProductDetail } from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Button } from '@santexgo/ui/button';
import { Field } from '@santexgo/ui/field';
import { Modal } from '@santexgo/ui/modal';
import { toast } from '@santexgo/ui/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { SelectField } from '@/components/form/controls';

type Documents = AdminProductDetail['documents'];

const TYPES = {
  CERTIFICATE: 'Sertifikat',
  PASSPORT: 'Texnik pasport',
  MANUAL: 'Yo‘riqnoma',
  OTHER: 'Boshqa',
} as const;

/** Sertifikat, pasport, yo'riqnoma (PDF, 20 MB gacha). */
export function ProductDocuments({ product }: { product: AdminProductDetail }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<keyof typeof TYPES>('CERTIFICATE');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const setDocuments = (documents: Documents) =>
    queryClient.setQueryData<AdminProductDetail>(
      ['admin', 'products', 'detail', product.id],
      (old) => (old ? { ...old, documents } : old),
    );

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('file', file!);
      form.append('type', type);
      form.append('title', title);
      return api<Documents>(`/admin/products/${product.id}/documents`, {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: (documents) => {
      setDocuments(documents);
      setOpen(false);
      setTitle('');
      setFile(null);
      toast.success('Hujjat yuklandi');
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api<void>(`/admin/products/${product.id}/documents/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => setDocuments(product.documents.filter((d) => d.id !== id)),
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className="card p-4">
      <h2 className="mb-3 font-semibold">Hujjatlar</h2>
      {product.documents.length > 0 ? (
        <ul className="space-y-2">
          {product.documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-brand-700 hover:underline"
              >
                {doc.title}
              </a>
              <span className="text-xs text-slate-500">
                {TYPES[doc.type as keyof typeof TYPES] ?? doc.type}
              </span>
              <button
                type="button"
                aria-label={`${doc.title} — o‘chirish`}
                className="rounded p-1 text-slate-400 hover:bg-sale-soft hover:text-sale"
                onClick={() => {
                  if (window.confirm('Hujjat o‘chirilsinmi?')) remove.mutate(doc.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Sertifikat yoki yo‘riqnoma yuklanmagan.</p>
      )}
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Hujjat qo‘shish
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Hujjat qo‘shish">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            upload.mutate();
          }}
        >
          <SelectField
            label="Turi"
            value={type}
            onChange={(e) => setType(e.target.value as keyof typeof TYPES)}
          >
            {Object.entries(TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <Field
            label="Nomi"
            placeholder="Muvofiqlik sertifikati №..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">PDF fayl (20 MB gacha)</span>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium"
            />
          </label>
          {upload.error ? <Alert tone="error">{errorMessage(upload.error)}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              type="submit"
              loading={upload.isPending}
              disabled={!file || title.trim() === ''}
            >
              Yuklash
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
