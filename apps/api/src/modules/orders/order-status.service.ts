import { Injectable } from '@nestjs/common';
import {
  canTransitionOrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STEPS,
  type OrderStatus,
} from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import type { Order, Prisma } from '../../generated/prisma/client.js';
import { OrderStockService } from './order-stock.service.js';

type Tx = Prisma.TransactionClient;

/** Yetkazilganda to'lov avtomatik "to'langan" bo'ladigan usullar (pul kuryerga beriladi). */
const PAID_ON_DELIVERY = new Set(['CASH', 'CARD_ON_DELIVERY']);

function stepIndex(status: OrderStatus): number {
  return ORDER_STATUS_STEPS.indexOf(status);
}

/**
 * Buyurtma statusini o'zgartirish va uning oqibatlari (bitta tranzaksiyada):
 * - "Tayyorlanmoqda"     → buyurtma tasdiqlangan vaqt yoziladi;
 * - "Yetkazib berilmoqda" → band qilingan mahsulot ombordan chiqadi;
 * - "Yetkazildi"         → sotilganlar soni oshadi, naqd/karta to'lovi "to'langan" bo'ladi;
 * - "Bekor qilindi"      → band bo'shaydi, yo'lga chiqqan mahsulot omborga qaytadi.
 * Oraliq bosqich o'tkazib yuborilsa, uning oqibatlari ham bajariladi.
 */
@Injectable()
export class OrderStatusService {
  constructor(private readonly stock: OrderStockService) {}

  /** Buyurtmani tranzaksiya oxirigacha qulflaydi (bir vaqtda ikki o'zgarish bo'lmasligi uchun). */
  async lock(tx: Tx, where: { orderNumber: number; userId?: string }): Promise<Order | null> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM orders WHERE order_number = ${where.orderNumber} FOR NO KEY UPDATE`;
    const id = rows[0]?.id;
    if (!id) return null;
    const order = await tx.order.findUnique({ where: { id } });
    if (!order || (where.userId && order.userId !== where.userId)) return null;
    return order;
  }

  async transition(
    tx: Tx,
    order: Order,
    to: OrderStatus,
    actor: { userId: string; note?: string | null },
  ): Promise<void> {
    const from = order.status;
    if (!canTransitionOrderStatus(from, to)) {
      throw ApiError.conflict(
        'ORDER_STATUS_INVALID',
        `“${ORDER_STATUS_LABELS[from]}” holatidagi buyurtmani “${ORDER_STATUS_LABELS[to]}” holatiga o‘tkazib bo‘lmaydi`,
      );
    }

    const now = new Date();
    const data: Prisma.OrderUpdateInput = { status: to };
    if (to === 'CANCELLED') {
      if (order.shippedAt) await this.stock.returnShipped(tx, order.id, actor.userId);
      await this.stock.release(tx, order.id, actor.userId);
      data.cancelledAt = now;
      data.cancelReason = actor.note ?? null;
      if (order.paymentStatus === 'PENDING') {
        data.paymentStatus = 'CANCELLED';
        await tx.payment.updateMany({
          where: { orderId: order.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      }
    } else {
      if (stepIndex(to) >= stepIndex('PREPARING') && !order.confirmedAt) data.confirmedAt = now;
      if (stepIndex(to) >= stepIndex('DELIVERING') && !order.shippedAt) {
        await this.stock.ship(tx, order.id, actor.userId);
        data.shippedAt = now;
      }
      if (to === 'DELIVERED') {
        data.deliveredAt = now;
        await this.addSoldCount(tx, order.id);
        if (order.paymentStatus === 'PENDING' && PAID_ON_DELIVERY.has(order.paymentMethod)) {
          data.paymentStatus = 'PAID';
          await tx.payment.updateMany({
            where: { orderId: order.id, status: 'PENDING' },
            data: { status: 'PAID', paidAt: now },
          });
        }
      }
    }

    await tx.order.update({ where: { id: order.id }, data });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: from,
        toStatus: to,
        note: actor.note ?? null,
        changedById: actor.userId,
      },
    });
  }

  /** "Ko'p sotilganlar" uchun: yetkazilgan buyurtmadagi miqdorlar. */
  private async addSoldCount(tx: Tx, orderId: string): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { productId: true, quantity: true },
      orderBy: { productId: 'asc' },
    });
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { soldCount: { increment: item.quantity } },
      });
    }
  }
}
