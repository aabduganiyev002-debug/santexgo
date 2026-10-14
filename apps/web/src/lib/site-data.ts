import 'server-only';
import {
  type BrandSummary,
  type CategoryNode,
  DEFAULT_DELIVERY_SETTINGS,
  DEFAULT_STORE_SETTINGS,
  type SiteSettings,
} from '@santexgo/shared';
import { serverGet } from './api/server';

export interface LayoutData {
  categories: CategoryNode[];
  brands: BrandSummary[];
  settings: SiteSettings;
}

/**
 * Har bir sahifada kerak bo'ladigan ma'lumotlar (menyu, footer). 5 daqiqa keshlanadi.
 * API vaqtincha ishlamasa ham sayt ochiladi — bo'sh menyu bilan.
 */
export async function getLayoutData(): Promise<LayoutData> {
  const [categories, brands, settings] = await Promise.all([
    serverGet<CategoryNode[]>('/catalog/categories', { revalidate: 300 }).catch(() => []),
    serverGet<BrandSummary[]>('/catalog/brands', { revalidate: 300 }).catch(() => []),
    serverGet<SiteSettings>('/site/settings', { revalidate: 300 }).catch(() => ({
      store: DEFAULT_STORE_SETTINGS,
      delivery: DEFAULT_DELIVERY_SETTINGS,
    })),
  ]);
  return { categories, brands, settings };
}

export function getSettings(): Promise<SiteSettings> {
  return serverGet<SiteSettings>('/site/settings', { revalidate: 300 });
}
