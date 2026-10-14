import type { AddressView, OrderSummaryView } from './orders.js';

export interface AdminCustomerListItem {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  isActive: boolean;
  ordersCount: number;
  /** Yetkazilgan buyurtmalar summasi */
  totalSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
}

export interface AdminCustomerDetail extends AdminCustomerListItem {
  lastLoginAt: string | null;
  deliveredCount: number;
  activeOrdersCount: number;
  cancelledCount: number;
  /** O'rtacha buyurtma summasi (yetkazilganlar bo'yicha) */
  averageOrder: number;
  addresses: AddressView[];
  recentOrders: OrderSummaryView[];
}
