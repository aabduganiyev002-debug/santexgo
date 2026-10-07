import type { ProductUnit } from '../product.js';

/** Rasm uchta o'lchamda (WebP): ro'yxat, kartochka va katta ko'rinish uchun. */
export interface ImageUrls {
  url: string;
  medium: string;
  thumb: string;
  alt: string | null;
}

export interface BrandSummary {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  productCount: number;
}

export interface BrandDetail extends BrandSummary {
  description: string | null;
  country: string | null;
  website: string | null;
  /** Brend sahifasidagi bo'limlar: "PPR TRUBA", "PVC TRUBA"... (shu brendda mahsuloti borlari) */
  sections: CollectionSummary[];
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  /** Kategoriya va uning barcha subkategoriyalaridagi faol mahsulotlar soni */
  productCount: number;
  children: CategoryNode[];
}

export interface Breadcrumb {
  slug: string;
  name: string;
}

export interface CategoryDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
  /** Bosh sahifadan joriy kategoriyagacha */
  breadcrumbs: Breadcrumb[];
  children: CategoryNode[];
}

export interface MaterialSummary {
  id: string;
  slug: string;
  name: string;
  fullName: string | null;
  productCount: number;
}

/** "Material bo'yicha" tugmasi — tayyor filtr. */
export interface CollectionSummary {
  slug: string;
  title: string;
  imageUrl: string | null;
  /** Katalogdagi filtrlar: /catalog/{category}?material=...&brand=... */
  filter: { category: string | null; material: string | null; brand: string | null };
  productCount: number;
}

export interface PriceInfo {
  /** Chegirmasiz narx (so'm) */
  base: number;
  /** Mijoz to'laydigan narx (so'm) */
  current: number;
  /** 0 — chegirma yo'q */
  discountPercent: number;
  /** Chegirma tugash vaqti (ISO), muddatsiz yoki chegirma yo'q — null */
  discountEndsAt: string | null;
}

export interface StockInfo {
  /** Sotuvga mavjud miqdor (omborda bor − band qilingan) */
  available: number;
  inStock: boolean;
  /** Kam qolgan (masalan "Oxirgi 5 dona") */
  low: boolean;
}

/** Ro'yxatdagi mahsulot kartochkasi. */
export interface ProductCard {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand: { slug: string; name: string };
  image: ImageUrls | null;
  unit: ProductUnit;
  minOrderQty: number;
  price: PriceInfo;
  stock: StockInfo;
  isNew: boolean;
  rating: { average: number; count: number };
}

export interface ProductAttribute {
  key: string;
  name: string;
  unit: string | null;
  /** Ko'rsatish uchun tayyor qiymat: "25", "PN20", "Ha" */
  value: string;
  /** NUMBER turidagi xususiyat uchun son */
  numberValue: number | null;
}

export interface ProductVariant {
  slug: string;
  sku: string;
  /** Almashtiriladigan qiymat: "Ø25", "3/4\"" */
  label: string;
  price: number;
  inStock: boolean;
  isCurrent: boolean;
}

export interface ProductDocumentInfo {
  type: 'CERTIFICATE' | 'PASSPORT' | 'MANUAL' | 'OTHER';
  title: string;
  url: string;
}

export interface ProductDetail extends ProductCard {
  shortDescription: string | null;
  description: string | null;
  images: ImageUrls[];
  category: { slug: string; name: string };
  breadcrumbs: Breadcrumb[];
  material: { slug: string; name: string; fullName: string | null } | null;
  attributes: ProductAttribute[];
  variants: ProductVariant[];
  /** Variantlar qaysi xususiyat bo'yicha almashadi (masalan "Diametr") */
  variantAttributeName: string | null;
  documents: ProductDocumentInfo[];
  weightGrams: number | null;
  warrantyMonths: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

// ─────────────────────────────── Filtrlar ───────────────────────────────

export const PRODUCT_SORTS = [
  'popular',
  'new',
  'price_asc',
  'price_desc',
  'discount',
  'relevance',
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  popular: 'Ommabop',
  new: 'Yangilari',
  price_asc: 'Arzonroq',
  price_desc: 'Qimmatroq',
  discount: 'Chegirma bo‘yicha',
  relevance: 'Mosligi bo‘yicha',
};

export interface FacetValue {
  value: string;
  label: string;
  count: number;
  selected: boolean;
}

export interface AttributeFacet {
  key: string;
  name: string;
  unit: string | null;
  type: 'NUMBER' | 'TEXT' | 'BOOLEAN';
  values: FacetValue[];
}

export interface CategoryFacet {
  slug: string;
  name: string;
  count: number;
}

export interface ProductFacets {
  brands: FacetValue[];
  materials: FacetValue[];
  /** Tanlangan kategoriyaning subkategoriyalari (yoki asosiy kategoriyalar) */
  categories: CategoryFacet[];
  attributes: AttributeFacet[];
  price: { min: number; max: number } | null;
  inStockCount: number;
  onSaleCount: number;
}

export interface ProductListResponse {
  items: ProductCard[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  facets: ProductFacets;
  /** Tanlangan kategoriya (filtr bo'lsa) */
  category: CategoryDetail | null;
}

export interface SearchSuggestions {
  query: string;
  products: ProductCard[];
  brands: { slug: string; name: string }[];
  categories: { slug: string; name: string }[];
}

export interface BannerInfo {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
}

export interface HomePageData {
  banners: BannerInfo[];
  brands: BrandSummary[];
  collections: CollectionSummary[];
  categories: CategoryNode[];
  sale: ProductCard[];
  newArrivals: ProductCard[];
  bestSellers: ProductCard[];
}

/** Kam qolgan qoldiq chegarasi (sotuvga mavjud miqdor shundan kam bo'lsa "low") */
export const LOW_STOCK_DISPLAY_THRESHOLD = 10;
/** Shuncha kun ichida qo'shilgan mahsulot "Yangi" belgisi bilan chiqadi */
export const NEW_PRODUCT_DAYS = 30;

/** sitemap.xml uchun: barcha ochiq sahifalar va oxirgi o'zgarish vaqti. */
export interface SitemapData {
  products: { slug: string; updatedAt: string }[];
  categories: { slug: string }[];
  brands: { slug: string; updatedAt: string }[];
}
