import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { maskUzPhone } from '@santexgo/shared';
import type { Env } from '../../config/env.schema.js';
import { ApiError } from '../../common/errors/api-error.js';
import { RateLimitService } from '../rate-limit/rate-limit.service.js';
import { SmsSender } from './sms-sender.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SMS yuborish: kunlik umumiy limit (SMS balansini suiiste'moldan himoya qiladi),
 * xatolarni foydalanuvchiga tushunarli javobga aylantirish va loglash.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly dailyLimit: number;
  private readonly timeZone: string;

  constructor(
    private readonly sender: SmsSender,
    private readonly counters: RateLimitService,
    config: ConfigService<Env, true>,
  ) {
    this.dailyLimit = config.get('SMS_DAILY_LIMIT', { infer: true });
    this.timeZone = config.get('APP_TIMEZONE', { infer: true });
  }

  async send(phone: string, message: string): Promise<void> {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: this.timeZone }).format(new Date());
    const { count } = await this.counters.hit(`sms-daily:${day}`, DAY_MS);
    if (count > this.dailyLimit) {
      this.logger.error(`Kunlik SMS limiti (${this.dailyLimit}) tugadi — SMS yuborilmadi`);
      throw ApiError.serviceUnavailable(
        'SMS_SEND_FAILED',
        'SMS yuborish vaqtincha cheklangan. Birozdan keyin qayta urinib ko‘ring',
      );
    }

    try {
      await this.sender.send(phone, message);
      this.logger.log(`SMS yuborildi: ${maskUzPhone(phone)} (${this.sender.name})`);
    } catch (error) {
      this.logger.error(`SMS yuborilmadi: ${maskUzPhone(phone)}: ${(error as Error).message}`);
      throw ApiError.serviceUnavailable(
        'SMS_SEND_FAILED',
        'SMS yuborib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring',
      );
    }
  }
}
