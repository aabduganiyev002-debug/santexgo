import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatOrderNumber, maskUzPhone, type OrderStatus } from '@santexgo/shared';
import type { Env } from '../../config/env.schema.js';
import { SmsService } from '../../infra/sms/sms.service.js';

export interface OrderNotice {
  orderNumber: number;
  customerPhone: string;
  total: number;
}

/** "1 250 000" — SMS uchun (faqat ASCII belgilar). */
function amount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * SMS matnlari: faqat lotin harflari va ASCII (aks holda SMS Unicode'da ketadi, narxi 2 baravar).
 * Eskiz.uz ishlatilsa, har biri kabinetda shablon sifatida tasdiqlangan bo'lishi kerak.
 */
export const ORDER_SMS = {
  created: (o: OrderNotice) =>
    `SantexGo: buyurtmangiz qabul qilindi. Raqami: ${formatOrderNumber(o.orderNumber)}. ` +
    `Jami: ${amount(o.total)} so'm. Operator tez orada bog'lanadi.`,
  DELIVERING: (o: OrderNotice) =>
    `SantexGo: ${formatOrderNumber(o.orderNumber)} buyurtmangiz yo'lga chiqdi.`,
  DELIVERED: (o: OrderNotice) =>
    `SantexGo: ${formatOrderNumber(o.orderNumber)} buyurtmangiz yetkazildi. Xaridingiz uchun rahmat!`,
  CANCELLED: (o: OrderNotice) =>
    `SantexGo: ${formatOrderNumber(o.orderNumber)} buyurtmangiz bekor qilindi.`,
} as const;

/**
 * Buyurtma xabarnomalari. Hozir: mijozga SMS (ORDER_SMS_ENABLED=true bo'lsa).
 * Keyinchalik shu yerga Telegram bot (adminlarga yangi buyurtma) va push qo'shiladi.
 * Xabar yuborilmasa ham buyurtma amali to'xtamaydi.
 */
@Injectable()
export class OrderNotificationsService {
  private readonly logger = new Logger(OrderNotificationsService.name);
  private readonly smsEnabled: boolean;

  constructor(
    private readonly sms: SmsService,
    config: ConfigService<Env, true>,
  ) {
    this.smsEnabled = config.get('ORDER_SMS_ENABLED', { infer: true });
  }

  orderCreated(order: OrderNotice): void {
    this.logger.log(
      `Yangi buyurtma ${formatOrderNumber(order.orderNumber)}: ${amount(order.total)} so'm, ` +
        maskUzPhone(order.customerPhone),
    );
    this.send(order.customerPhone, ORDER_SMS.created(order));
  }

  statusChanged(order: OrderNotice, status: OrderStatus): void {
    if (status === 'DELIVERING' || status === 'DELIVERED' || status === 'CANCELLED') {
      this.send(order.customerPhone, ORDER_SMS[status](order));
    }
  }

  private send(phone: string, message: string): void {
    if (!this.smsEnabled) return;
    this.sms.send(phone, message).catch((error: unknown) => {
      this.logger.warn(`Buyurtma SMS'i yuborilmadi: ${(error as Error).message}`);
    });
  }
}
