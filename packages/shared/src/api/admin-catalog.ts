import type { ProductUnit } from '../product.js';

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  country: string | null;
  website: string | null;
  sortOrder: number;
  isFeatured: boolean;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Daraxtdagi chuqurlik (0 — asosiy kategoriya) */
  depth: number;
  /** "Fittinglar / Tirsaklar" */
  path: string;
  /** Faqat shu kategoriyaga biriktirilgan mahsulotlar */
  productCount: number;
  /** Ichki kategoriyalar bilan birga */
  totalProductCount: number;
  childCount: number;
  attributeIds: string[];
}

export interface AdminMaterial {
  id: string;
  name: string;
  slug: string;
  fullName: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface AdminAttribute {
  id: string;
  key: string;
  name: string;
  unit: string | null;
  type: 'NUMBER' | 'TEXT' | 'BOOLEAN';
  isFilterable: boolean;
  isVisible: boolean;
  sortOrder: number;
  /** Nechta mahsulotda qiymati bor */
  usageCount: number;
  categoryIds: string[];
}

export interface AdminProductGroup {
  id: string;
  name: string;
  variantAttributeKey: string | null;
  productCount: number;
}

export interface AdminWarehouse {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface AdminProductListItem {
  id: string;
  sku: string;
  name: string;
  slug: string;
  brand: { id: string; name: string };
  category: { id: string; name: string };
  material: { id: string; name: string } | null;
  thumbUrl: string | null;
  unit: ProductUnit;
  basePrice: number;
  currentPrice: number;
  discountPercent: number;
  availableStock: number;
  reservedStock: number;
  soldCount: number;
  isActive: boolean;
  isFeatured: boolean;
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductImage {
  id: string;
  url: string;
  medium: string;
  thumb: string;
  alt: string | null;
  isMain: boolean;
  sortOrder: number;
  width: number | null;
  height: number | null;
}

export interface AdminProductAttributeValue {
  attributeId: string;
  key: string;
  name: string;
  unit: string | null;
  type: 'NUMBER' | 'TEXT' | 'BOOLEAN';
  value: number | string | boolean;
}

export interface AdminWarehouseStock {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  isDefault: boolean;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}

export interface AdminProductDetail extends Omit<AdminProductListItem, 'thumbUrl'> {
  brandId: string;
  categoryId: string;
  materialId: string | null;
  groupId: string | null;
  group: { id: string; name: string; variantAttributeKey: string | null } | null;
  shortDescription: string | null;
  description: string | null;
  minOrderQty: number;
  weightGrams: number | null;
  warrantyMonths: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  attributes: AdminProductAttributeValue[];
  images: AdminProductImage[];
  documents: { id: string; type: string; title: string; url: string }[];
  stock: AdminWarehouseStock[];
  appliedDiscount: { id: string; name: string; endsAt: string | null } | null;
  /** Buyurtmalarda bor — o'chirilmaydi, faqat arxivlanadi */
  hasOrders: boolean;
}

export interface AdminInventoryMovement {
  id: string;
  type: 'RESTOCK' | 'ORDER_RESERVE' | 'ORDER_RELEASE' | 'ORDER_SHIP' | 'RETURN' | 'ADJUSTMENT';
  warehouse: { code: string; name: string };
  quantityChange: number;
  reservedChange: number;
  quantityAfter: number;
  reservedAfter: number;
  orderNumber: number | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export const INVENTORY_MOVEMENT_LABELS: Record<AdminInventoryMovement['type'], string> = {
  RESTOCK: 'Kirim',
  ORDER_RESERVE: 'Buyurtma uchun band qilindi',
  ORDER_RELEASE: 'Band bekor qilindi',
  ORDER_SHIP: 'Buyurtma jo‘natildi',
  RETURN: 'Qaytarildi',
  ADJUSTMENT: 'Tuzatish (inventarizatsiya)',
};

export interface DeleteResult {
  /** deleted — butunlay o'chirildi; archived — buyurtmalarda bor, arxivlandi */
  result: 'deleted' | 'archived';
}
