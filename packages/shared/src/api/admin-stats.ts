import type { OrderStatus } from '../order.js';
import type { StatsRange } from '../schemas/stats-admin.js';

/** Savdo — bekor qilinmagan buyurtmalar summasi (yetkazib berish bilan), so'm. */
export interface SalesFigures {
  orders: number;
  revenue: number;
}

/** Bosh sahifa ko'rsatkichlari (Toshkent vaqti bilan). */
export interface AdminStatsOverview {
  today: SalesFigures & { itemsSold: number };
  yesterday: SalesFigures;
  /** Joriy oy boshidan bugungacha */
  month: SalesFigures;
  /** O'tgan oyning xuddi shu kunlari (taqqoslash uchun) */
  previousMonth: SalesFigures;
  /** Tasdiqlanishi kutilayotgan buyurtmalar (qabul qilindi + tasdiqlanmoqda) */
  pendingOrders: number;
  customers: { total: number; newThisMonth: number };
  products: { active: number; inStock: number; lowStock: number; outOfStock: number };
}

export interface SalesPoint extends SalesFigures {
  /** Kun: "2026-10-07"; oy: "2026-10" */
  period: string;
  itemsSold: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  revenue: number;
}

export interface TopBrand {
  brandId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface TopCustomer {
  userId: string;
  name: string;
  phone: string;
  orders: number;
  revenue: number;
}

export interface AdminSalesStats {
  range: StatsRange;
  bucket: 'day' | 'month';
  /** Davr boshlanishi (ISO) */
  from: string;
  totals: SalesFigures & { itemsSold: number; averageOrder: number; cancelled: number };
  series: SalesPoint[];
  statuses: Record<OrderStatus, number>;
  topProducts: TopProduct[];
  topBrands: TopBrand[];
  topCustomers: TopCustomer[];
}
