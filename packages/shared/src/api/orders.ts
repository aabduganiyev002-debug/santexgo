import type { DeliveryMethod, OrderStatus, PaymentMethod, PaymentStatus } from '../order.js';
import type { ProductUnit } from '../product.js';
import type { ImageUrls, PriceInfo, StockInfo } from './catalog.js';

/**
 * Savatcha qatoridagi muammo. OUT_OF_STOCK qatorlar buyurtmaga kirmaydi;
 * INSUFFICIENT_STOCK va BELOW_MIN — buyurtma berishdan oldin miqdorni tuzatish kerak.
 */
export type CartIssue = 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'BELOW_MIN';

export const CART_ISSUE_LABELS: Record<CartIssue, string> = {
  OUT_OF_STOCK: 'Sotuvda yo‘q',
  INSUFFICIENT_STOCK: 'Omborda yetarli emas',
  BELOW_MIN: 'Eng kam buyurtma miqdoridan kam',
};

export interface CartLineView {
  productId: string;
  slug: string;
  sku: string;
  name: string;
  brand: { slug: string; name: string };
  image: ImageUrls | null;
  unit: ProductUnit;
  quantity: number;
  minOrderQty: number;
  /** Shu mahsulotdan ko'pi bilan qancha olish mumkin (sotuvdagi qoldiq) */
  maxQuantity: number;
  price: PriceInfo;
  stock: StockInfo;
  /** Chegirmasiz summa */
  lineBase: number;
  lineDiscount: number;
  lineTotal: number;
  issue: CartIssue | null;
}

/** Summalar faqat buyurtma qilsa bo'ladigan qatorlar (sotuvda borlari) bo'yicha. */
export interface CartSummary {
  /** Jami dona (miqdorlar yig'indisi) */
  itemsCount: number;
  linesCount: number;
  /** Chegirmasiz summa */
  subtotal: number;
  discountTotal: number;
  /** Mahsulotlar summasi (chegirma bilan) */
  itemsTotal: number;
  /** Yetkazib berish (manzilga yetkazishda) */
  deliveryFee: number;
  total: number;
  freeDeliveryFrom: number | null;
  /** Bepul yetkazib berishgacha qancha qoldi (0 — bepul) */
  freeDeliveryRemaining: number;
}

export interface CartView {
  lines: CartLineView[];
  summary: CartSummary;
  /** Miqdorni tuzatish kerak bo'lgan qator bor — buyurtma berib bo'lmaydi */
  hasIssues: boolean;
  /** Sotuvdan olingan yoki o'chirilgan mahsulotlar (savatchadan olib tashlandi) */
  unavailableProductIds: string[];
}

export interface AddressView {
  id: string;
  label: string | null;
  region: string;
  district: string;
  street: string;
  house: string | null;
  apartment: string | null;
  landmark: string | null;
  isDefault: boolean;
}

export interface OrderItemView {
  productId: string;
  slug: string | null;
  sku: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  unit: ProductUnit;
  unitPrice: number;
  discountAmount: number;
  finalUnitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderAddressView {
  region: string;
  district: string;
  street: string;
  house: string | null;
  apartment: string | null;
  landmark: string | null;
}

export interface OrderHistoryEntry {
  status: OrderStatus;
  note: string | null;
  createdAt: string;
  /** Faqat admin ko'rinishida */
  changedBy?: string | null;
}

export interface OrderSummaryView {
  id: string;
  orderNumber: number;
  /** "ORDER-10254" */
  number: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
  itemsCount: number;
  previewImages: string[];
}

export interface OrderDetailView extends OrderSummaryView {
  customer: { firstName: string; lastName: string; phone: string };
  deliveryMethod: DeliveryMethod;
  address: OrderAddressView | null;
  comment: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  items: OrderItemView[];
  history: OrderHistoryEntry[];
  canCancel: boolean;
  cancelReason: string | null;
}

export interface AdminOrderListItem extends OrderSummaryView {
  customerName: string;
  customerPhone: string;
  userId: string;
  deliveryMethod: DeliveryMethod;
  region: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
}

export interface AdminOrderListResponse {
  items: AdminOrderListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Filtrdagi sana va qidiruv bo'yicha har bir statusdagi buyurtmalar soni */
  statusCounts: Record<OrderStatus, number>;
}

export interface AdminOrderDetail extends OrderDetailView {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    ordersCount: number;
    /** Yetkazilgan buyurtmalar summasi */
    totalSpent: number;
  };
  adminNote: string | null;
  /** Hozirgi statusdan o'tish mumkin bo'lgan statuslar */
  allowedTransitions: OrderStatus[];
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
}

export interface FavoriteIds {
  productIds: string[];
}
