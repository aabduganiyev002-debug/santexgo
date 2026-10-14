import { Logger } from '@nestjs/common';
import { SmsSender } from './sms-sender.js';

export interface SentSms {
  phone: string;
  message: string;
  sentAt: Date;
}

const OUTBOX_LIMIT = 50;

/**
 * Lokal ishlab chiqish uchun: SMS yuborilmaydi, matni terminalga chiqadi.
 * Testlar oxirgi xabarlarni `outbox` dan o'qiydi. Production'da ishlatib bo'lmaydi (env tekshiruvi).
 */
export class ConsoleSmsSender extends SmsSender {
  readonly name = 'console';
  readonly outbox: SentSms[] = [];
  private readonly logger = new Logger('SMS');

  send(phone: string, message: string): Promise<void> {
    this.outbox.push({ phone, message, sentAt: new Date() });
    if (this.outbox.length > OUTBOX_LIMIT) this.outbox.shift();
    this.logger.log(`📱 ${phone}: ${message}`);
    return Promise.resolve();
  }

  /** Testlar uchun: shu raqamga yuborilgan oxirgi xabar. */
  lastMessageTo(phone: string): string | undefined {
    return this.outbox.findLast((sms) => sms.phone === phone)?.message;
  }
}
