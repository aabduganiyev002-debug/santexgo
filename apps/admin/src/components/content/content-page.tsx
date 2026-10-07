'use client';

import type { AdminBanner, AdminHomeCollection } from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Badge } from '@santexgo/ui/badge';
import { Button } from '@santexgo/ui/button';
import { Field } from '@santexgo/ui/field';
import { formatDateTime } from '@santexgo/ui/format';
import { Modal } from '@santexgo/ui/modal';
import { toast } from '@santexgo/ui/toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/data/states';
import { SelectField, Toggle } from '@/components/form/controls';
import { ImagePicker } from '@/components/form/image-picker';
import { PageHeader } from '@/components/page-header';
import { categoryOptionLabel, useBrands, useCategories, useMaterials } from '@/lib/reference-data';

const BANNERS_KEY = ['admin', 'banners'];
const COLLECTIONS_KEY = ['admin', 'home-collections'];

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContentPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Bannerlar va bosh sahifa"
        description="O‘zgarishlar saytda 1–5 daqiqada ko‘rinadi"
      />
      <BannersSection />
      <CollectionsSection />
    </div>
  );
}

// ─────────────────────────────── Bannerlar ───────────────────────────────

function BannersSection() {
  const queryClient = useQueryClient();
  const banners = useQuery({
    queryKey: BANNERS_KEY,
    queryFn: () => api<AdminBanner[]>('/admin/banners'),
  });
  const [editing, setEditing] = useState<AdminBanner | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/banners/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BANNERS_KEY });
      toast.success('Banner o‘chirildi');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Banner slayderi</h2>
          <p className="text-sm text-slate-500">
            Kompyuter uchun 1920×640, telefon uchun 800×800 tavsiya etiladi
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Banner qo‘shish
        </Button>
      </div>
      {banners.isPending ? (
        <TableSkeleton rows={3} />
      ) : banners.error ? (
        <ErrorState error={banners.error} />
      ) : banners.data.length === 0 ? (
        <EmptyState title="Banner yo‘q" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {banners.data.map((banner) => (
            <li key={banner.id} className="card overflow-hidden">
              <div className="aspect-[3/1] bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan rasm */}
                <img src={banner.imageUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{banner.title ?? 'Sarlavhasiz'}</p>
                  {banner.isActive ? (
                    <Badge tone="success">Faol</Badge>
                  ) : (
                    <Badge>O‘chirilgan</Badge>
                  )}
                </div>
                {banner.linkUrl ? (
                  <p className="truncate text-xs text-slate-500">→ {banner.linkUrl}</p>
                ) : null}
                <p className="text-xs text-slate-500">
                  {banner.startsAt ? `${formatDateTime(banner.startsAt)} dan` : 'Hozirdan'}
                  {banner.endsAt ? ` · ${formatDateTime(banner.endsAt)} gacha` : ' · muddatsiz'}
                  {` · tartib ${banner.sortOrder}`}
                </p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(banner)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Tahrirlash
                  </Button>
                  <Button
                    variant="ghostDanger"
                    size="sm"
                    aria-label="O‘chirish"
                    onClick={() => {
                      if (window.confirm('Banner o‘chirilsinmi?')) remove.mutate(banner.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Yangi banner' : 'Bannerni tahrirlash'}
        className="max-w-xl"
      >
        {editing !== null ? (
          <BannerForm
            key={editing === 'new' ? 'new' : editing.id}
            banner={editing === 'new' ? null : editing}
            onSaved={() => {
              void queryClient.invalidateQueries({ queryKey: BANNERS_KEY });
              setEditing(null);
              toast.success('Saqlandi');
            }}
          />
        ) : null}
      </Modal>
    </section>
  );
}

/** Tanlangan faylning vaqtinchalik ko'rinishi (oyna yopilganda xotiradan bo'shatiladi). */
function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return url;
}

function BannerForm({ banner, onSaved }: { banner: AdminBanner | null; onSaved: () => void }) {
  const [title, setTitle] = useState(banner?.title ?? '');
  const [subtitle, setSubtitle] = useState(banner?.subtitle ?? '');
  const [linkUrl, setLinkUrl] = useState(banner?.linkUrl ?? '');
  const [sortOrder, setSortOrder] = useState(String(banner?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);
  const [startsAt, setStartsAt] = useState(toLocalInput(banner?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(banner?.endsAt ?? null));
  const [image, setImage] = useState<File | null>(null);
  const [mobileImage, setMobileImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imagePreview = useObjectUrl(image);
  const mobilePreview = useObjectUrl(mobileImage);

  const save = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('title', title);
      form.append('subtitle', subtitle);
      form.append('linkUrl', linkUrl);
      form.append('sortOrder', sortOrder || '0');
      form.append('isActive', String(isActive));
      form.append('startsAt', startsAt ? new Date(startsAt).toISOString() : '');
      form.append('endsAt', endsAt ? new Date(endsAt).toISOString() : '');
      if (image) form.append('image', image);
      if (mobileImage) form.append('mobileImage', mobileImage);
      return api(banner ? `/admin/banners/${banner.id}` : '/admin/banners', {
        method: banner ? 'PATCH' : 'POST',
        body: form,
      });
    },
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e)),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (!banner && !image) {
          setError('Banner rasmini tanlang');
          return;
        }
        save.mutate();
      }}
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <ImagePicker
          label="Rasm (kompyuter)"
          aspect="wide"
          url={imagePreview ?? banner?.imageUrl ?? null}
          onPick={setImage}
        />
        <ImagePicker
          label="Rasm (telefon, ixtiyoriy)"
          url={mobilePreview ?? banner?.mobileImageUrl ?? null}
          onPick={setMobileImage}
        />
      </div>
      <Field label="Sarlavha" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Field
        label="Qo‘shimcha matn"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
      />
      <Field
        label="Havola"
        placeholder="/brands/plastherm yoki /catalog?onSale=1"
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Boshlanishi"
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
        />
        <Field
          label="Tugashi"
          type="datetime-local"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
        <Field
          label="Tartib"
          inputMode="numeric"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value.replace(/[^\d-]/g, ''))}
        />
      </div>
      <Toggle label="Faol" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending}>
          Saqlash
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────── "Material bo'yicha" tugmalari ───────────────────────

function CollectionsSection() {
  const queryClient = useQueryClient();
  const collections = useQuery({
    queryKey: COLLECTIONS_KEY,
    queryFn: () => api<AdminHomeCollection[]>('/admin/home-collections'),
  });
  const [editing, setEditing] = useState<AdminHomeCollection | 'new' | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/home-collections/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void refresh();
      toast.success('O‘chirildi');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">“Material bo‘yicha” tugmalari</h2>
          <p className="text-sm text-slate-500">
            Bosh sahifada: PPR TRUBA, PVC TRUBA, PP KANALIZATSIYA... — tayyor filtrlar
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tugma qo‘shish
        </Button>
      </div>
      {collections.isPending ? (
        <TableSkeleton rows={3} />
      ) : collections.error ? (
        <ErrorState error={collections.error} />
      ) : collections.data.length === 0 ? (
        <EmptyState title="Tugma yo‘q" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tugma</th>
                <th>Filtr</th>
                <th className="text-right">Tartib</th>
                <th>Holat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {collections.data.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-slate-100">
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- API tayyorlagan rasm
                          <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-slate-300" aria-hidden="true" />
                        )}
                      </div>
                      <span className="font-medium">{c.title}</span>
                    </div>
                  </td>
                  <td className="text-slate-600">{c.filterLabel}</td>
                  <td className="tabular text-right text-slate-500">{c.sortOrder}</td>
                  <td>
                    {c.isActive ? <Badge tone="success">Faol</Badge> : <Badge>Yashirin</Badge>}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Tahrirlash
                    </Button>
                    <Button
                      variant="ghostDanger"
                      size="sm"
                      aria-label="O‘chirish"
                      onClick={() => {
                        if (window.confirm(`“${c.title}” o‘chirilsinmi?`)) remove.mutate(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Yangi tugma' : 'Tugmani tahrirlash'}
      >
        {editing !== null ? (
          <CollectionForm
            key={editing === 'new' ? 'new' : editing.id}
            collection={editing === 'new' ? null : editing}
            onSaved={(saved, created) => {
              void refresh();
              if (created) {
                setEditing(saved);
                toast.success('Qo‘shildi. Rasmini yuklashingiz mumkin');
              } else {
                setEditing(null);
                toast.success('Saqlandi');
              }
            }}
          />
        ) : null}
      </Modal>
    </section>
  );
}

function CollectionForm({
  collection,
  onSaved,
}: {
  collection: AdminHomeCollection | null;
  onSaved: (collection: AdminHomeCollection, created: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const materials = useMaterials();
  const categories = useCategories();
  const brands = useBrands();
  const [title, setTitle] = useState(collection?.title ?? '');
  const [materialId, setMaterialId] = useState(collection?.materialId ?? '');
  const [categoryId, setCategoryId] = useState(collection?.categoryId ?? '');
  const [brandId, setBrandId] = useState(collection?.brandId ?? '');
  const [sortOrder, setSortOrder] = useState(String(collection?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(collection?.isActive ?? true);
  const [imageUrl, setImageUrl] = useState(collection?.imageUrl ?? null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api<AdminHomeCollection>(
        collection ? `/admin/home-collections/${collection.id}` : '/admin/home-collections',
        {
          method: collection ? 'PATCH' : 'POST',
          body: {
            title,
            materialId: materialId || null,
            categoryId: categoryId || null,
            brandId: brandId || null,
            sortOrder: sortOrder || '0',
            isActive,
          },
        },
      ),
    onSuccess: (saved) => onSaved(saved, collection === null),
    onError: (e) => setError(errorMessage(e)),
  });
  const image = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api<AdminHomeCollection>(`/admin/home-collections/${collection!.id}/image`, {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: (saved) => {
      setImageUrl(saved.imageUrl);
      void queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        save.mutate();
      }}
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {collection ? (
        <ImagePicker
          label="Rasm"
          url={imageUrl}
          busy={image.isPending}
          onPick={(file) => image.mutate(file)}
        />
      ) : null}
      <Field
        label="Tugma matni"
        placeholder="PPR TRUBA"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <p className="text-sm text-slate-500">Filtr: kamida bittasini tanlang</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Material"
          value={materialId}
          onChange={(e) => setMaterialId(e.target.value)}
        >
          <option value="">—</option>
          {materials.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Kategoriya"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">—</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryOptionLabel(c)}
            </option>
          ))}
        </SelectField>
        <SelectField label="Brend" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
          <option value="">—</option>
          {brands.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Tartib"
          inputMode="numeric"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value.replace(/[^\d-]/g, ''))}
        />
        <Toggle
          label="Faol"
          className="self-end"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending}>
          Saqlash
        </Button>
      </div>
    </form>
  );
}
