import type { DiscountType } from '../discount.js';
import type { DiscountStatus } from '../schemas/discount-admin.js';

export interface AdminDiscountListItem {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  startsAt: string;
  endsAt: string | null;
  priority: number;
  isActive: boolean;
  status: DiscountStatus;
  targets: {
    productCount: number;
    categories: string[];
    brands: string[];
  };
  /** Hozir shu chegirma qo'llangan mahsulotlar soni */
  appliedCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDiscountDetail extends AdminDiscountListItem {
  targetProducts: { id: string; sku: string; name: string }[];
  targetCategories: { id: string; name: string; path: string }[];
  targetBrands: { id: string; name: string }[];
}

/** Chegirma ta'sir qiladigan mahsulot: narxlar va shu chegirma qo'llanganmi */
export interface AdminDiscountProduct {
  id: string;
  sku: string;
  name: string;
  basePrice: number;
  currentPrice: number;
  /** Shu chegirma bo'yicha narx (boshqa chegirma foydaliroq bo'lsa, u qo'llanadi) */
  priceWithThisDiscount: number;
  isApplied: boolean;
  appliedDiscountName: string | null;
}
