'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type AdminAttribute,
  type AdminMaterial,
  type AdminProductGroup,
  type AttributeInput,
  attributeInputSchema,
  attributeUpdateSchema,
  type MaterialInput,
  materialInputSchema,
  productGroupInputSchema,
} from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Badge } from '@santexgo/ui/badge';
import { Button } from '@santexgo/ui/button';
import { cn } from '@santexgo/ui/cn';
import { Field } from '@santexgo/ui/field';
import { applyApiErrors } from '@santexgo/ui/form-errors';
import { Modal } from '@santexgo/ui/modal';
import { toast } from '@santexgo/ui/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useForm } from 'react-hook-form';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/data/states';
import { SelectField, TextAreaField, Toggle } from '@/components/form/controls';
import { PageHeader } from '@/components/page-header';
import {
  REF_KEYS,
  useAttributes,
  useMaterials,
  useProductGroups,
  useWarehouses,
} from '@/lib/reference-data';
import { useListParams } from '@/lib/use-list-params';

const TABS = [
  { value: 'materials', label: 'Materiallar' },
  { value: 'attributes', label: 'Xususiyatlar' },
  { value: 'groups', label: 'Variant guruhlari' },
  { value: 'warehouses', label: 'Omborlar' },
] as const;

const ATTRIBUTE_TYPES = { NUMBER: 'Son', TEXT: 'Matn', BOOLEAN: 'Ha / Yo‘q' } as const;

export function TaxonomyPage() {
  const { values, update } = useListParams({ tab: 'materials' });
  return (
    <div>
      <PageHeader
        title="Materiallar va xususiyatlar"
        description="Katalog filtrlari: material (PPR, PVC, PP...), diametr, bosim klassi va boshqalar"
      />
      <div role="tablist" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={values.tab === tab.value}
            onClick={() => update({ tab: tab.value })}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium',
              values.tab === tab.value
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {values.tab === 'attributes' ? (
        <AttributesTab />
      ) : values.tab === 'groups' ? (
        <GroupsTab />
      ) : values.tab === 'warehouses' ? (
        <WarehousesTab />
      ) : (
        <MaterialsTab />
      )}
    </div>
  );
}

/** Ro'yxat + qo'shish/tahrirlash oynasi + o'chirish uchun umumiy qism */
function useCrud(resource: string, refKey: readonly string[], noun: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: refKey });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/${resource}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(`${noun} o‘chirildi`);
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const save = async (id: string | null, body: unknown) => {
    await api(id ? `/admin/${resource}/${id}` : `/admin/${resource}`, {
      method: id ? 'PATCH' : 'POST',
      body,
    });
    void refresh();
    toast.success('Saqlandi');
  };
  const confirmRemove = (id: string, name: string) => {
    if (window.confirm(`“${name}” o‘chirilsinmi?`)) remove.mutate(id);
  };
  return { save, confirmRemove };
}

function Toolbar({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <div className="mb-3 flex justify-end">
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
    </div>
  );
}

function RowActions({ onEdit, onRemove }: { onEdit: () => void; onRemove: () => void }) {
  return (
    <td className="whitespace-nowrap text-right">
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Tahrirlash
      </Button>
      <Button variant="ghostDanger" size="sm" aria-label="O‘chirish" onClick={onRemove}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </td>
  );
}

function ListState({
  query,
  children,
}: {
  query: { isPending: boolean; error: unknown; data?: unknown[] };
  children: ReactNode;
}) {
  if (query.isPending) return <TableSkeleton />;
  if (query.error) return <ErrorState error={query.error} />;
  if (!query.data?.length) return <EmptyState title="Hali qo‘shilmagan" />;
  return <div className="card overflow-x-auto">{children}</div>;
}

// ─────────────────────────────── Materiallar ───────────────────────────────

function MaterialsTab() {
  const materials = useMaterials();
  const crud = useCrud('materials', REF_KEYS.materials, 'Material');
  const [editing, setEditing] = useState<AdminMaterial | 'new' | null>(null);
  return (
    <>
      <Toolbar label="Material qo‘shish" onAdd={() => setEditing('new')} />
      <ListState query={materials}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>To‘liq nomi</th>
              <th className="text-right">Mahsulotlar</th>
              <th>Holat</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {materials.data?.map((m) => (
              <tr key={m.id}>
                <td>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-slate-500">/{m.slug}</p>
                </td>
                <td className="text-slate-600">{m.fullName ?? '—'}</td>
                <td className="tabular text-right">{m.productCount}</td>
                <td>{m.isActive ? <Badge tone="success">Faol</Badge> : <Badge>Yashirin</Badge>}</td>
                <RowActions
                  onEdit={() => setEditing(m)}
                  onRemove={() => crud.confirmRemove(m.id, m.name)}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </ListState>
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Yangi material' : 'Materialni tahrirlash'}
      >
        {editing !== null ? (
          <MaterialForm
            material={editing === 'new' ? null : editing}
            onSave={async (body) => {
              await crud.save(editing === 'new' ? null : editing.id, body);
              setEditing(null);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function MaterialForm({
  material,
  onSave,
}: {
  material: AdminMaterial | null;
  onSave: (body: MaterialInput) => Promise<void>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MaterialInput>({
    resolver: zodResolver(materialInputSchema),
    defaultValues: {
      name: material?.name ?? '',
      slug: material?.slug ?? '',
      fullName: material?.fullName ?? '',
      description: material?.description ?? '',
      sortOrder: material?.sortOrder ?? 0,
      isActive: material?.isActive ?? true,
    },
  });
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSave(values);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['name', 'slug', 'fullName', 'sortOrder']));
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Qisqa nomi"
          placeholder="PPR"
          error={errors.name?.message}
          {...register('name')}
        />
        <Field label="Manzil (slug)" error={errors.slug?.message} {...register('slug')} />
      </div>
      <Field
        label="To‘liq nomi"
        placeholder="Polipropilen random-sopolimer"
        error={errors.fullName?.message}
        {...register('fullName')}
      />
      <TextAreaField label="Tavsif" rows={3} {...register('description')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tartib raqami" inputMode="numeric" {...register('sortOrder')} />
        <Toggle label="Saytda ko‘rinadi" className="self-end" {...register('isActive')} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Saqlash
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────── Xususiyatlar ───────────────────────────────

function AttributesTab() {
  const attributes = useAttributes();
  const crud = useCrud('attributes', REF_KEYS.attributes, 'Xususiyat');
  const [editing, setEditing] = useState<AdminAttribute | 'new' | null>(null);
  return (
    <>
      <Toolbar label="Xususiyat qo‘shish" onAdd={() => setEditing('new')} />
      <ListState query={attributes}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Xususiyat</th>
              <th>Kalit</th>
              <th>Turi</th>
              <th className="text-right">Mahsulotlarda</th>
              <th>Ko‘rinishi</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {attributes.data?.map((a) => (
              <tr key={a.id}>
                <td className="font-medium">
                  {a.name}
                  {a.unit ? <span className="ml-1 text-slate-400">({a.unit})</span> : null}
                </td>
                <td className="font-mono text-xs text-slate-600">{a.key}</td>
                <td className="text-slate-600">{ATTRIBUTE_TYPES[a.type]}</td>
                <td className="tabular text-right">{a.usageCount}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {a.isFilterable ? <Badge tone="brand">Filtrda</Badge> : null}
                    {a.isVisible ? <Badge tone="success">Sahifada</Badge> : <Badge>Yashirin</Badge>}
                  </div>
                </td>
                <RowActions
                  onEdit={() => setEditing(a)}
                  onRemove={() => crud.confirmRemove(a.id, a.name)}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </ListState>
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Yangi xususiyat' : 'Xususiyatni tahrirlash'}
      >
        {editing !== null ? (
          <AttributeForm
            attribute={editing === 'new' ? null : editing}
            onSave={async (body) => {
              await crud.save(editing === 'new' ? null : editing.id, body);
              setEditing(null);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function AttributeForm({
  attribute,
  onSave,
}: {
  attribute: AdminAttribute | null;
  onSave: (body: unknown) => Promise<void>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const isNew = attribute === null;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AttributeInput>({
    // Kalit va tur faqat yaratishda beriladi (keyin o'zgarmaydi — qiymatlar shunga bog'liq)
    resolver: zodResolver(isNew ? attributeInputSchema : (attributeUpdateSchema as never)),
    defaultValues: {
      key: attribute?.key ?? '',
      name: attribute?.name ?? '',
      unit: attribute?.unit ?? '',
      type: attribute?.type ?? 'NUMBER',
      isFilterable: attribute?.isFilterable ?? true,
      isVisible: attribute?.isVisible ?? true,
      sortOrder: attribute?.sortOrder ?? 0,
    },
  });
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { key: _key, type: _type, ...rest } = values;
      await onSave(isNew ? values : rest);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['key', 'name', 'unit', 'type', 'sortOrder']));
    }
  });
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nomi"
          placeholder="Diametr"
          error={errors.name?.message}
          {...register('name')}
        />
        <Field
          label="O‘lchov birligi"
          placeholder="mm"
          error={errors.unit?.message}
          {...register('unit')}
        />
        <Field
          label="Kalit (URL filtri uchun)"
          placeholder="diameter_mm"
          disabled={!isNew}
          hint={isNew ? 'Keyin o‘zgartirib bo‘lmaydi' : undefined}
          error={errors.key?.message}
          {...register('key')}
        />
        <SelectField label="Turi" disabled={!isNew} {...register('type')}>
          {Object.entries(ATTRIBUTE_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <Field label="Tartib raqami" inputMode="numeric" {...register('sortOrder')} />
      </div>
      <div className="flex flex-wrap gap-6">
        <Toggle label="Katalog filtrida" {...register('isFilterable')} />
        <Toggle label="Mahsulot sahifasida" {...register('isVisible')} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Saqlash
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────── Variant guruhlari ───────────────────────────────

function GroupsTab() {
  const groups = useProductGroups();
  const attributes = useAttributes();
  const crud = useCrud('product-groups', REF_KEYS.groups, 'Guruh');
  const [editing, setEditing] = useState<AdminProductGroup | 'new' | null>(null);
  const [name, setName] = useState('');
  const [variantKey, setVariantKey] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const open = (group: AdminProductGroup | 'new') => {
    setEditing(group);
    setName(group === 'new' ? '' : group.name);
    setVariantKey(group === 'new' ? '' : (group.variantAttributeKey ?? ''));
    setFormError(null);
  };
  return (
    <>
      <p className="mb-3 text-sm text-slate-600">
        Bir xil mahsulotning o‘lchamlari bitta guruhga birlashtiriladi: mahsulot sahifasida “Ø20 ·
        Ø25 · Ø32” tugmalari chiqadi.
      </p>
      <Toolbar label="Guruh qo‘shish" onAdd={() => open('new')} />
      <ListState query={groups}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Guruh</th>
              <th>Variantlar bo‘yicha</th>
              <th className="text-right">Mahsulotlar</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.data?.map((g) => (
              <tr key={g.id}>
                <td className="font-medium">{g.name}</td>
                <td className="text-slate-600">
                  {attributes.data?.find((a) => a.key === g.variantAttributeKey)?.name ?? '—'}
                </td>
                <td className="tabular text-right">{g.productCount}</td>
                <RowActions
                  onEdit={() => open(g)}
                  onRemove={() => crud.confirmRemove(g.id, g.name)}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </ListState>
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Yangi guruh' : 'Guruhni tahrirlash'}
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const parsed = productGroupInputSchema.safeParse({
              name,
              variantAttributeKey: variantKey || null,
            });
            if (!parsed.success) {
              setFormError(parsed.error.issues[0]?.message ?? 'Xato');
              return;
            }
            try {
              await crud.save(editing === 'new' || !editing ? null : editing.id, parsed.data);
              setEditing(null);
            } catch (error) {
              setFormError(errorMessage(error));
            }
          }}
        >
          {formError ? <Alert tone="error">{formError}</Alert> : null}
          <Field
            label="Nomi"
            placeholder="Plastherm PPR truba PN20"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <SelectField
            label="Variantlar qaysi xususiyat bo‘yicha"
            value={variantKey}
            onChange={(e) => setVariantKey(e.target.value)}
          >
            <option value="">—</option>
            {attributes.data?.map((a) => (
              <option key={a.id} value={a.key}>
                {a.name}
              </option>
            ))}
          </SelectField>
          <div className="flex justify-end">
            <Button type="submit">Saqlash</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─────────────────────────────── Omborlar ───────────────────────────────

function WarehousesTab() {
  const warehouses = useWarehouses();
  return (
    <>
      <p className="mb-3 text-sm text-slate-600">
        Sotuvdagi qoldiq barcha faol omborlar yig‘indisi. Buyurtma avval asosiy ombordan band
        qilinadi.
      </p>
      <ListState query={warehouses}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Kod</th>
              <th>Nomi</th>
              <th>Manzil</th>
              <th>Holat</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.data?.map((w) => (
              <tr key={w.id}>
                <td className="font-mono text-xs">{w.code}</td>
                <td className="font-medium">
                  {w.name}
                  {w.isDefault ? (
                    <Badge tone="brand" className="ml-2">
                      Asosiy
                    </Badge>
                  ) : null}
                </td>
                <td className="text-slate-600">{w.address ?? '—'}</td>
                <td>{w.isActive ? <Badge tone="success">Faol</Badge> : <Badge>Yopiq</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListState>
    </>
  );
}
