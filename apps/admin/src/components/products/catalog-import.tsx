'use client';

import {
  CATALOG_IMPORT_BATCH_SIZE,
  CATALOG_IMPORT_FILE,
  CATALOG_IMPORT_MAX_SKUS_PER_IMAGE,
  type CatalogImportBatchResult,
  type CatalogImportFile,
  type CatalogImportImageResult,
  type CatalogImportProductResult,
  catalogImportFileSchema,
} from '@santexgo/shared';
import { Alert } from '@santexgo/ui/alert';
import { api } from '@santexgo/ui/api-client';
import { errorMessage } from '@santexgo/ui/api-errors';
import { Button, buttonClass } from '@santexgo/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { strFromU8, unzipSync } from 'fflate';
import { CheckCircle2, FileArchive, Upload } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/** Rasmlar parallel yuboriladi (server har birini WebP'ga o'giradi) */
const IMAGE_CONCURRENCY = 3;

interface LoadedCatalog {
  fileName: string;
  catalog: CatalogImportFile;
  /** ZIP ichidagi rasmlar: katalog.json ga nisbatan yo'l → fayl */
  images: Map<string, Uint8Array>;
  /** Faylda ko'rsatilgan, lekin ZIP'da yo'q rasmlar */
  missingImages: string[];
}

interface Progress {
  stage: 'products' | 'images';
  done: number;
  total: number;
}

interface Summary {
  created: number;
  updated: number;
  failed: CatalogImportProductResult[];
  imagesAttached: number;
  warnings: string[];
}

type State =
  | { step: 'idle'; error?: string; issues?: string[] }
  | { step: 'reading' }
  | { step: 'ready'; loaded: LoadedCatalog }
  | { step: 'running'; loaded: LoadedCatalog; progress: Progress }
  | { step: 'failed'; loaded: LoadedCatalog; error: string }
  | { step: 'done'; loaded: LoadedCatalog; summary: Summary };

/**
 * Katalogni yuklash: ZIP (ildizida katalog.json, rasmlar images/ da) brauzerda ochiladi va API'ga
 * bo'laklab yuboriladi. Qayta yuklash xavfsiz: mahsulotlar SKU bo'yicha yangilanadi, rasmlar
 * faqat rasmi yo'q mahsulotlarga qo'shiladi.
 */
export function CatalogImport() {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ step: 'idle' });
  const running = state.step === 'running';

  // Yuklash paytida sahifani yopish yoki yangilashdan ogohlantiradi
  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setState({ step: 'reading' });
    try {
      setState({ step: 'ready', loaded: await readCatalog(file) });
    } catch (error) {
      setState(
        error instanceof CatalogFileError
          ? { step: 'idle', error: error.message, issues: error.issues }
          : { step: 'idle', error: 'Faylni o‘qib bo‘lmadi. Bu ZIP fayl ekanini tekshiring.' },
      );
    }
  };

  const start = async (loaded: LoadedCatalog) => {
    try {
      const summary = await runImport(loaded, (progress) =>
        setState({ step: 'running', loaded, progress }),
      );
      setState({ step: 'done', loaded, summary });
    } catch (error) {
      setState({ step: 'failed', loaded, error: errorMessage(error) });
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(event) => {
          void pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />

      {state.step === 'idle' || state.step === 'reading' ? (
        <div className="card space-y-4 p-6">
          {state.step === 'idle' && state.error ? (
            <Alert tone="error">
              <p>{state.error}</p>
              {state.issues?.length ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs">
                  {state.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </Alert>
          ) : null}
          <div className="flex items-start gap-3">
            <FileArchive className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" aria-hidden="true" />
            <div className="space-y-1 text-sm text-slate-600">
              <p className="font-medium text-slate-900">SantexGo katalog fayli (.zip)</p>
              <p>
                Yangi mahsulotlar qoldig‘i va rasmlari bilan qo‘shiladi. Saytda bor mahsulotlarning
                (SKU bo‘yicha) faqat nomi va narxi yangilanadi — qoldig‘i, kategoriyasi va rasmlari
                o‘zgarmaydi. Faylni qayta yuklash xavfsiz.
              </p>
            </div>
          </div>
          <Button onClick={() => input.current?.click()} loading={state.step === 'reading'}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Faylni tanlash
          </Button>
        </div>
      ) : (
        <CatalogOverview loaded={state.loaded} />
      )}

      {state.step === 'ready' ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void start(state.loaded)}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Yuklashni boshlash
          </Button>
          <Button variant="outline" onClick={() => input.current?.click()}>
            Boshqa fayl
          </Button>
        </div>
      ) : null}

      {state.step === 'running' ? <ProgressCard progress={state.progress} /> : null}

      {state.step === 'failed' ? (
        <div className="space-y-3">
          <Alert tone="error">
            Yuklash to‘xtadi: {state.error}. Qayta urinib ko‘ring — allaqachon qo‘shilganlar
            takrorlanmaydi.
          </Alert>
          <Button onClick={() => void start(state.loaded)}>Qayta urinish</Button>
        </div>
      ) : null}

      {state.step === 'done' ? <ResultCard summary={state.summary} /> : null}
    </div>
  );
}

function CatalogOverview({ loaded }: { loaded: LoadedCatalog }) {
  const { catalog } = loaded;
  const categoryNames = new Map(catalog.categories.map((c) => [c.slug, c.name]));
  const perCategory = new Map<string, number>();
  for (const product of catalog.products) {
    perCategory.set(product.category, (perCategory.get(product.category) ?? 0) + 1);
  }
  const withImages = catalog.products.filter((p) => p.images?.length).length;
  const stats: Array<[string, number]> = [
    ['Mahsulot', catalog.products.length],
    ['Rasmli mahsulot', withImages],
    ['Rasm fayli', loaded.images.size],
    ['Kategoriya', perCategory.size],
  ];

  return (
    <div className="card space-y-4 p-6">
      <div>
        <p className="text-xs text-slate-500">{loaded.fileName}</p>
        <h2 className="text-lg font-bold">{catalog.title ?? 'Katalog'}</h2>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="tabular text-lg font-semibold">{value.toLocaleString('ru-RU')}</dd>
          </div>
        ))}
      </dl>
      <ul className="flex flex-wrap gap-1.5 text-xs">
        {[...perCategory.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([slug, count]) => (
            <li key={slug} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
              {categoryNames.get(slug) ?? slug} · {count}
            </li>
          ))}
      </ul>
      {loaded.missingImages.length > 0 ? (
        <Alert tone="info">
          ZIP ichida {loaded.missingImages.length} ta rasm topilmadi — ular o‘tkazib yuboriladi
          (masalan: {loaded.missingImages.slice(0, 3).join(', ')}).
        </Alert>
      ) : null}
    </div>
  );
}

function ProgressCard({ progress }: { progress: Progress }) {
  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 100;
  const label = progress.stage === 'products' ? 'Mahsulotlar' : 'Rasmlar';
  return (
    <div className="card space-y-3 p-6" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {label}: {progress.done.toLocaleString('ru-RU')} /{' '}
          {progress.total.toLocaleString('ru-RU')}
        </span>
        <span className="tabular text-slate-500">{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">
        Sahifani yopmang — yuklash tugaguncha bir necha daqiqa ketishi mumkin.
      </p>
    </div>
  );
}

function ResultCard({ summary }: { summary: Summary }) {
  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-center gap-2 text-lg font-bold text-emerald-700">
        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        Katalog yuklandi
      </div>
      <ul className="space-y-1 text-sm">
        <li>
          Yangi mahsulotlar: <b>{summary.created.toLocaleString('ru-RU')}</b>
        </li>
        <li>
          Yangilangan (nomi va narxi): <b>{summary.updated.toLocaleString('ru-RU')}</b>
        </li>
        <li>
          Rasm qo‘shilgan mahsulotlar: <b>{summary.imagesAttached.toLocaleString('ru-RU')}</b>
        </li>
        {summary.failed.length > 0 ? (
          <li className="text-sale">
            Qo‘shilmadi: <b>{summary.failed.length}</b>
          </li>
        ) : null}
      </ul>
      {summary.failed.length > 0 ? (
        <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Sabab</th>
              </tr>
            </thead>
            <tbody>
              {summary.failed.map((item) => (
                <tr key={item.sku} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-mono">{item.sku}</td>
                  <td className="px-3 py-1.5">{item.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {summary.warnings.length > 0 ? (
        <Alert tone="info">
          <ul className="list-disc space-y-0.5 pl-5">
            {summary.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <Link href="/products" className={buttonClass('primary')}>
        Mahsulotlarga o‘tish
      </Link>
    </div>
  );
}

// ─────────────────────────────── Fayl va yuklash ───────────────────────────────

class CatalogFileError extends Error {
  constructor(
    message: string,
    readonly issues?: string[],
  ) {
    super(message);
  }
}

async function readCatalog(file: File): Promise<LoadedCatalog> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  // katalog.json ZIP ildizida yoki bitta papka ichida bo'lishi mumkin
  const manifest = Object.keys(entries)
    .filter((name) => name === CATALOG_IMPORT_FILE || name.endsWith(`/${CATALOG_IMPORT_FILE}`))
    .sort((a, b) => a.length - b.length)[0];
  if (!manifest) {
    throw new CatalogFileError(
      `ZIP ichida ${CATALOG_IMPORT_FILE} yo‘q — bu SantexGo katalogi emas.`,
    );
  }
  const base = manifest.slice(0, manifest.length - CATALOG_IMPORT_FILE.length);

  let json: unknown;
  try {
    json = JSON.parse(strFromU8(entries[manifest]!));
  } catch {
    throw new CatalogFileError(`${CATALOG_IMPORT_FILE} buzilgan (JSON emas).`);
  }
  const parsed = catalogImportFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new CatalogFileError(
      'Katalog fayli noto‘g‘ri to‘ldirilgan:',
      parsed.error.issues
        .slice(0, 10)
        .map((issue) => `${issue.path.join('.') || 'fayl'}: ${issue.message}`),
    );
  }

  const images = new Map<string, Uint8Array>();
  const missing = new Set<string>();
  for (const product of parsed.data.products) {
    const path = product.images?.[0];
    if (!path) continue;
    const data = entries[base + path];
    if (data) images.set(path, data);
    else missing.add(path);
  }
  return { fileName: file.name, catalog: parsed.data, images, missingImages: [...missing] };
}

async function runImport(
  loaded: LoadedCatalog,
  onProgress: (progress: Progress) => void,
): Promise<Summary> {
  const { catalog } = loaded;
  const results: CatalogImportProductResult[] = [];
  const warnings = new Set<string>();
  onProgress({ stage: 'products', done: 0, total: catalog.products.length });

  for (let start = 0; start < catalog.products.length; start += CATALOG_IMPORT_BATCH_SIZE) {
    const result = await api<CatalogImportBatchResult>('/admin/catalog-import/products', {
      method: 'POST',
      body: {
        // Kategoriyalar bir marta; brend va materiallar har bo'lakda (slug → mavjud brend nomi)
        ...(start === 0 ? { categories: catalog.categories } : {}),
        brands: catalog.brands,
        materials: catalog.materials,
        products: catalog.products.slice(start, start + CATALOG_IMPORT_BATCH_SIZE),
      },
    });
    results.push(...result.products);
    result.warnings.forEach((warning) => warnings.add(warning));
    onProgress({ stage: 'products', done: results.length, total: catalog.products.length });
  }

  // Rasm → shu rasm biriktiriladigan (rasmi yo'q) mahsulotlar. Asosiy rasm — images[0]
  const bySku = new Map(results.map((r) => [r.sku, r]));
  const targets = new Map<string, string[]>();
  for (const product of catalog.products) {
    const path = product.images?.[0];
    const result = bySku.get(product.sku);
    if (!path || !loaded.images.has(path) || !result || result.status === 'failed') continue;
    if (result.hasImages) continue;
    targets.set(path, [...(targets.get(path) ?? []), product.sku]);
  }
  const jobs = [...targets.entries()].flatMap(([path, skus]) =>
    chunk(skus, CATALOG_IMPORT_MAX_SKUS_PER_IMAGE).map((part) => ({ path, skus: part })),
  );

  let done = 0;
  let attached = 0;
  onProgress({ stage: 'images', done, total: jobs.length });
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: Math.min(IMAGE_CONCURRENCY, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const form = new FormData();
        form.append('skus', job.skus.join(','));
        form.append(
          'file',
          // slice() — oddiy ArrayBuffer'li nusxa (Blob shuni talab qiladi)
          new Blob([loaded.images.get(job.path)!.slice()], { type: imageType(job.path) }),
          job.path.split('/').pop(),
        );
        const result = await api<CatalogImportImageResult>('/admin/catalog-import/image', {
          method: 'POST',
          body: form,
        });
        attached += result.attached;
        onProgress({ stage: 'images', done: ++done, total: jobs.length });
      }
    }),
  );

  return {
    created: results.filter((r) => r.status === 'created').length,
    updated: results.filter((r) => r.status === 'updated').length,
    failed: results.filter((r) => r.status === 'failed'),
    imagesAttached: attached,
    warnings: [...warnings],
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    parts.push(items.slice(index, index + size));
  }
  return parts;
}

function imageType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return 'image/jpeg';
}
