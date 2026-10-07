import { Injectable } from '@nestjs/common';
import {
  ACTIVE_ORDER_STATUSES,
  CUSTOMER_CANCELLABLE_STATUSES,
  type OrderDetailView,
  type OrderSummaryView,
  type Paginated,
} from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { OrderNotificationsService } from '../notifications/order-notifications.service.js';
import { ORDER_DETAIL_INCLUDE, ORDER_SUMMARY_SELECT, OrderPresenter } from './order.presenter.js';
import { OrderStatusService } from './order-status.service.js';

const NOT_FOUND = 'Buyurtma topilmadi';

/** Mijozning o'z buyurtmalari: ro'yxat, tafsilot, bekor qilish. Boshqaning buyurtmasi — 404. */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: OrderPresenter,
    private readonly statuses: OrderStatusService,
    private readonly notifications: OrderNotificationsService,
  ) {}

  async list(
    userId: string,
    query: { status: 'active' | 'completed' | 'all'; page: number; pageSize: number },
  ): Promise<Paginated<OrderSummaryView>> {
    const where: Prisma.OrderWhereInput = { userId };
    if (query.status === 'active') where.status = { in: [...ACTIVE_ORDER_STATUSES] };
    if (query.status === 'completed') where.status = { in: ['DELIVERED', 'CANCELLED'] };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: ORDER_SUMMARY_SELECT,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: rows.map((row) => this.presenter.summary(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async detail(userId: string, orderNumber: number): Promise<OrderDetailView> {
    const row = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!row) throw ApiError.notFound(NOT_FOUND);
    return this.presenter.detail(row);
  }

  async cancel(userId: string, orderNumber: number, reason?: string): Promise<OrderDetailView> {
    const order = await this.prisma.$transaction(async (tx) => {
      const order = await this.statuses.lock(tx, { orderNumber, userId });
      if (!order) throw ApiError.notFound(NOT_FOUND);
      if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
        throw ApiError.conflict(
          'ORDER_NOT_CANCELLABLE',
          'Buyurtma tayyorlanmoqda — uni bekor qilish uchun operatorga qo‘ng‘iroq qiling',
        );
      }
      await this.statuses.transition(tx, order, 'CANCELLED', {
        userId,
        note: reason ? `Mijoz bekor qildi: ${reason}` : 'Mijoz bekor qildi',
      });
      return order;
    });
    this.notifications.statusChanged(order, 'CANCELLED');
    return this.detail(userId, orderNumber);
  }
}
