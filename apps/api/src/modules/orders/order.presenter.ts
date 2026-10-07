import { Injectable } from '@nestjs/common';
import {
  type AdminOrderListItem,
  CUSTOMER_CANCELLABLE_STATUSES,
  formatOrderNumber,
  type OrderDetailView,
  type OrderHistoryEntry,
  type OrderItemView,
  type OrderSummaryView,
} from '@santexgo/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { MediaService } from '../../infra/storage/media.service.js';

export const ORDER_SUMMARY_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  createdAt: true,
  total: true,
  itemsCount: true,
  items: { select: { imageUrl: true }, orderBy: { id: 'asc' }, take: 4 },
} satisfies Prisma.OrderSelect;

export const ADMIN_LIST_SELECT = {
  ...ORDER_SUMMARY_SELECT,
  userId: true,
  customerFirstName: true,
  customerLastName: true,
  customerPhone: true,
  deliveryMethod: true,
  deliveryRegion: true,
  paymentMethod: true,
  paymentStatus: true,
} satisfies Prisma.OrderSelect;

export const ORDER_DETAIL_INCLUDE = {
  items: {
    orderBy: { id: 'asc' },
    include: { product: { select: { slug: true, isActive: true } } },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
    include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
  },
} satisfies Prisma.OrderInclude;

type SummaryRow = Prisma.OrderGetPayload<{ select: typeof ORDER_SUMMARY_SELECT }>;
type AdminListRow = Prisma.OrderGetPayload<{ select: typeof ADMIN_LIST_SELECT }>;
export type OrderDetailRow = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

/** Bazadagi buyurtmani API javobiga aylantiradi (mijoz va admin ko'rinishlari). */
@Injectable()
export class OrderPresenter {
  constructor(private readonly media: MediaService) {}

  summary(row: SummaryRow): OrderSummaryView {
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      number: formatOrderNumber(row.orderNumber),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      total: row.total,
      itemsCount: row.itemsCount,
      previewImages: row.items.flatMap((item) => this.media.urlOrNull(item.imageUrl) ?? []),
    };
  }

  adminListItem(row: AdminListRow): AdminOrderListItem {
    return {
      ...this.summary(row),
      customerName: `${row.customerFirstName} ${row.customerLastName}`,
      customerPhone: row.customerPhone,
      userId: row.userId,
      deliveryMethod: row.deliveryMethod,
      region: row.deliveryRegion,
      paymentMethod: row.paymentMethod,
      paymentStatus: row.paymentStatus,
    };
  }

  /** admin=true bo'lsa: status izohlari va kim o'zgartirgani ham ko'rsatiladi. */
  detail(row: OrderDetailRow, admin = false): OrderDetailView {
    const items: OrderItemView[] = row.items.map((item) => ({
      productId: item.productId,
      slug: item.product.isActive ? item.product.slug : null,
      sku: item.sku,
      name: item.name,
      brandName: item.brandName,
      imageUrl: this.media.urlOrNull(item.imageUrl),
      unit: item.unit,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      finalUnitPrice: item.finalUnitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    }));
    const history: OrderHistoryEntry[] = row.statusHistory.map((entry) => ({
      status: entry.toStatus,
      note: admin ? entry.note : null,
      createdAt: entry.createdAt.toISOString(),
      ...(admin && {
        changedBy: entry.changedBy
          ? entry.changedBy.id === row.userId
            ? 'Mijoz'
            : `${entry.changedBy.firstName} ${entry.changedBy.lastName}`
          : null,
      }),
    }));
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      number: formatOrderNumber(row.orderNumber),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      total: row.total,
      itemsCount: row.itemsCount,
      previewImages: items.flatMap((item) => item.imageUrl ?? []).slice(0, 4),
      customer: {
        firstName: row.customerFirstName,
        lastName: row.customerLastName,
        phone: row.customerPhone,
      },
      deliveryMethod: row.deliveryMethod,
      address:
        row.deliveryMethod === 'DELIVERY' && row.deliveryRegion
          ? {
              region: row.deliveryRegion,
              district: row.deliveryDistrict ?? '',
              street: row.deliveryStreet ?? '',
              house: row.deliveryHouse,
              apartment: row.deliveryApartment,
              landmark: row.deliveryLandmark,
            }
          : null,
      comment: row.comment,
      paymentMethod: row.paymentMethod,
      paymentStatus: row.paymentStatus,
      subtotal: row.subtotal,
      discountTotal: row.discountTotal,
      deliveryFee: row.deliveryFee,
      items,
      history,
      canCancel: CUSTOMER_CANCELLABLE_STATUSES.includes(row.status),
      cancelReason: row.cancelReason,
    };
  }
}
