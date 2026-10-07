import { Injectable } from '@nestjs/common';
import {
  ACTIVE_ORDER_STATUSES,
  type AdminOrderDetail,
  type AdminOrderListResponse,
  adminOrderListQuerySchema,
  adminOrderUpdateSchema,
  ORDER_STATUS_TRANSITIONS,
  ORDER_STATUSES,
  type OrderStatus,
  orderStatusUpdateSchema,
  parseOrderNumber,
  type z,
} from '@santexgo/shared';
import type { ActorContext } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infra/prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { OrderNotificationsService } from '../../notifications/order-notifications.service.js';
import {
  ADMIN_LIST_SELECT,
  ORDER_DETAIL_INCLUDE,
  OrderPresenter,
} from '../../orders/order.presenter.js';
import { OrderStatusService } from '../../orders/order-status.service.js';

type ListQuery = z.output<typeof adminOrderListQuerySchema>;
const NOT_FOUND = 'Buyurtma topilmadi';

/**
 * Qidiruv: buyurtma raqami ("ORDER-10254", "10254"), telefon raqami (kamida 4 ta raqam)
 * yoki mijoz ismi/familiyasi. Faqat raqamlardan iborat so'z ham raqam, ham telefon bo'yicha qidiriladi.
 */
function searchWhere(q: string): Prisma.OrderWhereInput {
  const variants: Prisma.OrderWhereInput[] = [];
  const orderNumber = parseOrderNumber(q);
  if (orderNumber !== null && orderNumber <= 2_147_483_647) variants.push({ orderNumber });
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 4 && /^[\d\s+()-]+$/.test(q)) {
    variants.push({ customerPhone: { contains: digits } });
  }
  if (variants.length > 0) return { OR: variants };

  const words = q.split(/\s+/).filter(Boolean).slice(0, 4);
  return {
    AND: words.map((word) => ({
      OR: [
        { customerFirstName: { contains: word, mode: 'insensitive' as const } },
        { customerLastName: { contains: word, mode: 'insensitive' as const } },
      ],
    })),
  };
}

/** Admin: barcha buyurtmalar, statusni boshqarish, ichki izoh va to'lov holati. */
@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: OrderPresenter,
    private readonly statuses: OrderStatusService,
    private readonly notifications: OrderNotificationsService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListQuery): Promise<AdminOrderListResponse> {
    const base: Prisma.OrderWhereInput = {
      ...(query.q && searchWhere(query.q)),
      ...(query.userId && { userId: query.userId }),
      ...((query.from || query.to) && {
        createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) },
      }),
    };
    const where: Prisma.OrderWhereInput = { ...base };
    if (query.status === 'active') where.status = { in: [...ACTIVE_ORDER_STATUSES] };
    else if (query.status !== 'all') where.status = query.status;

    const [rows, total, groups] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: ADMIN_LIST_SELECT,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: base,
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
    ]);
    const statusCounts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
      OrderStatus,
      number
    >;
    for (const group of groups) {
      statusCounts[group.status] = (group._count as { _all: number })._all;
    }
    return {
      items: rows.map((row) => this.presenter.adminListItem(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
      statusCounts,
    };
  }

  async detail(orderNumber: number): Promise<AdminOrderDetail> {
    const row = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        ...ORDER_DETAIL_INCLUDE,
        user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!row) throw ApiError.notFound(NOT_FOUND);
    const [ordersCount, spent] = await this.prisma.$transaction([
      this.prisma.order.count({ where: { userId: row.userId } }),
      this.prisma.order.aggregate({
        where: { userId: row.userId, status: 'DELIVERED' },
        _sum: { total: true },
      }),
    ]);
    return {
      ...this.presenter.detail(row, true),
      user: { ...row.user, ordersCount, totalSpent: spent._sum.total ?? 0 },
      adminNote: row.adminNote,
      allowedTransitions: [...ORDER_STATUS_TRANSITIONS[row.status]],
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      shippedAt: row.shippedAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
    };
  }

  async changeStatus(
    orderNumber: number,
    input: z.output<typeof orderStatusUpdateSchema>,
    actor: ActorContext,
  ): Promise<AdminOrderDetail> {
    const { order, from } = await this.prisma.$transaction(
      async (tx) => {
        const order = await this.statuses.lock(tx, { orderNumber });
        if (!order) throw ApiError.notFound(NOT_FOUND);
        const from = order.status;
        await this.statuses.transition(tx, order, input.status, {
          userId: actor.userId,
          note: input.note ?? null,
        });
        return { order, from };
      },
      { timeout: 20_000 },
    );
    await this.audit.log({
      actorId: actor.userId,
      action: 'order.status_change',
      entityType: 'order',
      entityId: order.id,
      changes: { status: { from, to: input.status }, ...(input.note && { note: input.note }) },
      ipAddress: actor.ipAddress,
    });
    this.notifications.statusChanged(order, input.status);
    return this.detail(orderNumber);
  }

  async update(
    orderNumber: number,
    input: z.output<typeof adminOrderUpdateSchema>,
    actor: ActorContext,
  ): Promise<AdminOrderDetail> {
    const changes = await this.prisma.$transaction(async (tx) => {
      const order = await this.statuses.lock(tx, { orderNumber });
      if (!order) throw ApiError.notFound(NOT_FOUND);
      const data: Prisma.OrderUpdateInput = {};
      const changes: Record<string, { from: unknown; to: unknown }> = {};

      if (input.adminNote !== undefined) {
        const note = input.adminNote || null;
        if (note !== order.adminNote) {
          data.adminNote = note;
          changes.adminNote = { from: order.adminNote, to: note };
        }
      }
      if (input.paymentStatus && input.paymentStatus !== order.paymentStatus) {
        const to = input.paymentStatus;
        if (to === 'PAID' && order.status === 'CANCELLED') {
          throw ApiError.conflict('ORDER_STATUS_INVALID', 'Bekor qilingan buyurtma to‘lanmaydi');
        }
        if (to === 'REFUNDED' && order.paymentStatus !== 'PAID') {
          throw ApiError.conflict(
            'ORDER_STATUS_INVALID',
            'Faqat to‘langan summani qaytarish mumkin',
          );
        }
        data.paymentStatus = to;
        changes.paymentStatus = { from: order.paymentStatus, to };
        const payment = await tx.payment.findFirst({
          where: { orderId: order.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (payment) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: to, paidAt: to === 'PAID' ? new Date() : undefined },
          });
        }
      }
      if (Object.keys(changes).length > 0) {
        await tx.order.update({ where: { id: order.id }, data });
      }
      return { id: order.id, changes };
    });
    if (Object.keys(changes.changes).length > 0) {
      await this.audit.log({
        actorId: actor.userId,
        action: 'order.update',
        entityType: 'order',
        entityId: changes.id,
        changes: changes.changes,
        ipAddress: actor.ipAddress,
      });
    }
    return this.detail(orderNumber);
  }
}
