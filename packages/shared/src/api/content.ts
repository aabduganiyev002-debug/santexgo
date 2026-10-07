import type { DeliverySettings, StoreSettings } from '../schemas/content-admin.js';

export interface SiteSettings {
  store: StoreSettings;
  delivery: DeliverySettings;
}

export interface AdminBanner {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface AdminHomeCollection {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  materialId: string | null;
  categoryId: string | null;
  brandId: string | null;
  /** "PPR + Trubalar" */
  filterLabel: string;
  sortOrder: number;
  isActive: boolean;
}
