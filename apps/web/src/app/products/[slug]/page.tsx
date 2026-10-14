import type { ProductCard, ProductDetail, SiteSettings } from '@santexgo/shared';
import { Clock, FileText, ShieldCheck, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { Price } from '@/components/product/price';
import { ProductGallery } from '@/components/product/product-gallery';
import { ProductPurchase } from '@/components/product/product-purchase';
import { ProductRail } from '@/components/product/product-rail';
import { StockLabel } from '@/components/product/stock-label';
import { serverGet } from '@/lib/api/server';
import { cn } from '@santexgo/ui/cn';
import { SITE_URL } from '@/lib/config';
import { formatSom, timeLeft } from '@santexgo/ui/format';
import { getSettings } from '@/lib/site-data';

const DOCUMENT_LABELS: Record<ProductDetail['documents'][number]['type'], string> = {
  CERTIFICATE: 'Sertifikat',
  PASSPORT: 'Mahsulot pasporti',
  MANUAL: 'Yo‘riqnoma',
  OTHER: 'Hujjat',
};

function getProduct(slug: string) {
  return serverGet<ProductDetail>(`/catalog/products/${encodeURIComponent(slug)}`, {
    revalidate: 30,
  });
}

export async function generateMetadata(props: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProduct(slug);
  const description =
    product.metaDescription ??
    product.shortDescription ??
    `${product.name} — ${formatSom(product.price.current)}. ${product.brand.name}, SKU ${product.sku}.`;
  return {
    title: product.metaTitle ?? product.name,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      images: product.images[0] ? [{ url: product.images[0].medium }] : undefined,
    },
  };
}

export default async function ProductPage(props: PageProps<'/products/[slug]'>) {
  const { slug } = await props.params;
  const [product, similar, settings] = await Promise.all([
    getProduct(slug),
    serverGet<ProductCard[]>(`/catalog/products/${encodeURIComponent(slug)}/similar`, {
      revalidate: 300,
    }).catch(() => []),
    getSettings().catch(() => null),
  ]);

  const discountEnds = product.price.discountEndsAt ? timeLeft(product.price.discountEndsAt) : null;

  return (
    <div className="container-page space-y-8 py-4 sm:py-6">
      <Breadcrumbs
        items={[
          { href: '/catalog', label: 'Katalog' },
          ...product.breadcrumbs.map((c) => ({ href: `/catalog/${c.slug}`, label: c.name })),
          { href: `/products/${product.slug}`, label: product.name },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <ProductGallery images={product.images} name={product.name} />

        <div className="space-y-5">
          <div className="space-y-2">
            <Link
              href={`/brands/${product.brand.slug}`}
              className="text-sm font-bold uppercase tracking-wide text-brand-700 hover:underline"
            >
              {product.brand.name}
            </Link>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              {product.name}
            </h1>
            <p className="text-sm text-slate-500">
              SKU: <span className="font-mono text-slate-700">{product.sku}</span>
            </p>
          </div>

          <div className="card space-y-4 p-5">
            <Price price={product.price} unit={product.unit} size="page" />
            {discountEnds ? (
              <p className="inline-flex items-center gap-1.5 rounded-lg bg-sale-soft px-2.5 py-1 text-sm font-medium text-sale">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Chegirma tugashiga {discountEnds} qoldi
              </p>
            ) : null}
            <StockLabel stock={product.stock} unit={product.unit} />

            {product.variants.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  {product.variantAttributeName}
                </p>
                <ul className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <li key={variant.slug}>
                      <Link
                        href={`/products/${variant.slug}`}
                        aria-current={variant.isCurrent ? 'true' : undefined}
                        className={cn(
                          'inline-flex h-10 min-w-14 items-center justify-center rounded-xl border px-3 text-sm font-semibold',
                          variant.isCurrent
                            ? 'border-brand-600 bg-brand-50 text-brand-800'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-brand-600',
                          !variant.inStock && 'border-dashed text-slate-400',
                        )}
                        title={variant.inStock ? formatSom(variant.price) : 'Sotuvda yo‘q'}
                      >
                        {variant.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <ProductPurchase product={product} />
          </div>

          {product.shortDescription ? (
            <p className="leading-7 text-slate-700">{product.shortDescription}</p>
          ) : null}

          {product.attributes.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {product.attributes.slice(0, 6).map((attribute) => (
                <div key={attribute.key} className="flex flex-col">
                  <dt className="text-slate-500">{attribute.name}</dt>
                  <dd className="font-semibold text-slate-800">
                    {attribute.value}
                    {attribute.unit && attribute.numberValue !== null ? ` ${attribute.unit}` : ''}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {settings ? <DeliveryInfo settings={settings} /> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {product.description ? (
            <section className="card p-5 sm:p-6" aria-labelledby="description">
              <h2 id="description" className="text-lg font-bold">
                Tavsif
              </h2>
              <div className="mt-3 whitespace-pre-line leading-7 text-slate-700">
                {product.description}
              </div>
            </section>
          ) : null}

          {product.attributes.length > 0 ? (
            <section className="card p-5 sm:p-6" aria-labelledby="specs">
              <h2 id="specs" className="text-lg font-bold">
                Texnik xususiyatlar
              </h2>
              <table className="mt-3 w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  <SpecRow label="Brend" value={product.brand.name} />
                  <SpecRow label="Kategoriya" value={product.category.name} />
                  {product.material ? (
                    <SpecRow
                      label="Material"
                      value={product.material.fullName ?? product.material.name}
                    />
                  ) : null}
                  {product.attributes.map((attribute) => (
                    <SpecRow
                      key={attribute.key}
                      label={attribute.name}
                      value={`${attribute.value}${attribute.unit && attribute.numberValue !== null ? ` ${attribute.unit}` : ''}`}
                    />
                  ))}
                  {product.warrantyMonths ? (
                    <SpecRow label="Kafolat" value={`${product.warrantyMonths} oy`} />
                  ) : null}
                  {product.weightGrams ? (
                    <SpecRow
                      label="Og‘irligi"
                      value={`${(product.weightGrams / 1000).toLocaleString('ru-RU')} kg`}
                    />
                  ) : null}
                  <SpecRow label="SKU" value={product.sku} />
                </tbody>
              </table>
            </section>
          ) : null}
        </div>

        {product.documents.length > 0 ? (
          <section className="card h-fit p-5 sm:p-6" aria-labelledby="documents">
            <h2 id="documents" className="text-lg font-bold">
              Sertifikatlar va hujjatlar
            </h2>
            <ul className="mt-3 space-y-2">
              {product.documents.map((document) => (
                <li key={document.url}>
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:border-brand-600"
                  >
                    <FileText className="h-5 w-5 shrink-0 text-sale" aria-hidden="true" />
                    <span>
                      <span className="block font-semibold text-slate-800">{document.title}</span>
                      <span className="text-xs text-slate-500">
                        {DOCUMENT_LABELS[document.type]} · PDF
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <ProductRail title="O‘xshash mahsulotlar" products={similar} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd(product)).replace(/</g, '\\u003c'),
        }}
      />
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th scope="row" className="w-1/2 py-2.5 pr-4 text-left font-normal text-slate-500">
        {label}
      </th>
      <td className="py-2.5 font-medium text-slate-800">{value}</td>
    </tr>
  );
}

function DeliveryInfo({ settings }: { settings: SiteSettings }) {
  const { delivery } = settings;
  return (
    <ul className="space-y-2.5 rounded-2xl border border-slate-200 p-4 text-sm">
      <li className="flex gap-3">
        <Truck className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
        <span>
          <span className="font-semibold">Yetkazib berish: </span>
          {delivery.baseFee > 0 ? formatSom(delivery.baseFee) : 'bepul'}
          {delivery.freeFrom !== null
            ? `, ${formatSom(delivery.freeFrom)} dan ortiq buyurtmaga — bepul`
            : ''}
          {delivery.note ? <span className="block text-slate-500">{delivery.note}</span> : null}
        </span>
      </li>
      {delivery.pickupEnabled ? (
        <li className="flex gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
          <span>
            <span className="font-semibold">Do‘kondan olib ketish — bepul</span>
            {delivery.pickupAddress ? (
              <span className="block text-slate-500">{delivery.pickupAddress}</span>
            ) : null}
          </span>
        </li>
      ) : null}
    </ul>
  );
}

function productJsonLd(product: ProductDetail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku,
    brand: { '@type': 'Brand', name: product.brand.name },
    image: product.images.map((i) => (i.url.startsWith('http') ? i.url : `${SITE_URL}${i.url}`)),
    description: product.shortDescription ?? product.description ?? undefined,
    category: product.category.name,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/products/${product.slug}`,
      priceCurrency: 'UZS',
      price: product.price.current,
      availability: product.stock.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}
