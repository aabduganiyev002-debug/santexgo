import { randomInt } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AUTH_LIMITS, OTP_CODE_LENGTH, type SendCodeResponse } from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import type { VerificationPurpose } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SmsService } from '../../infra/sms/sms.service.js';
import { VERIFICATION_SMS } from './sms-messages.js';
import { TokenService } from './token.service.js';

const HOUR_MS = 60 * 60 * 1000;
/** Bir IP manzildan soatiga yuboriladigan kodlar (mobil operatorlarda ko'p mijoz bitta IP'da bo'ladi) */
const CODES_PER_IP_PER_HOUR = 30;

export interface SendOptions {
  ipAddress: string | null;
  /**
   * false — kod yaratiladi, lekin SMS yuborilmaydi. Parolni tiklashda ro'yxatdan o'tmagan raqam
   * uchun ishlatiladi: javob va limitlar bir xil bo'ladi, raqam bazada bor-yo'qligini bilib bo'lmaydi.
   */
  deliver?: boolean;
}

function generateCode(): string {
  return randomInt(0, 10 ** OTP_CODE_LENGTH)
    .toString()
    .padStart(OTP_CODE_LENGTH, '0');
}

/**
 * SMS tasdiqlash kodlari: yaratish, yuborish, tekshirish.
 * Kod 5 daqiqa amal qiladi, 5 ta noto'g'ri urinishdan keyin yaroqsiz bo'ladi,
 * bazada faqat HMAC xeshi saqlanadi, har bir kod faqat bir marta ishlatiladi.
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly tokens: TokenService,
  ) {}

  async send(
    phone: string,
    purpose: VerificationPurpose,
    { ipAddress, deliver = true }: SendOptions,
  ): Promise<SendCodeResponse> {
    const code = generateCode();
    const created = await this.prisma.$transaction(async (tx) => {
      // Bir raqamga parallel so'rovlar navbat bilan bajariladi (limitlarni aylanib o'tib bo'lmaydi)
      const lockKey = `verification:${purpose}:${phone}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS locked`;

      const now = Date.now();
      const hourAgo = new Date(now - HOUR_MS);
      const last = await tx.verificationCode.findFirst({
        where: { phone, purpose },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (last) {
        const waitMs = last.createdAt.getTime() + AUTH_LIMITS.codeResendSeconds * 1000 - now;
        if (waitMs > 0) {
          const retryAfter = Math.ceil(waitMs / 1000);
          throw ApiError.tooManyRequests(
            'CODE_RESEND_TOO_SOON',
            `Kodni qayta yuborish uchun ${retryAfter} soniya kuting`,
            retryAfter,
          );
        }
      }

      const [perPhone, perIp] = await Promise.all([
        tx.verificationCode.count({ where: { phone, createdAt: { gte: hourAgo } } }),
        ipAddress
          ? tx.verificationCode.count({ where: { ipAddress, createdAt: { gte: hourAgo } } })
          : Promise.resolve(0),
      ]);
      if (perPhone >= AUTH_LIMITS.codesPerPhonePerHour || perIp >= CODES_PER_IP_PER_HOUR) {
        throw ApiError.tooManyRequests(
          'SMS_LIMIT_REACHED',
          'SMS kodlar soni chegarasiga yetdingiz. Bir soatdan keyin qayta urinib ko‘ring',
          3600,
        );
      }

      // Oldingi kodlar yaroqsiz bo'ladi — faqat oxirgi yuborilgan kod ishlaydi
      await tx.verificationCode.updateMany({
        where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date(now) } },
        data: { expiresAt: new Date(now) },
      });
      return tx.verificationCode.create({
        data: {
          phone,
          purpose,
          codeHash: this.tokens.hashVerificationCode(purpose, phone, code),
          expiresAt: new Date(now + AUTH_LIMITS.codeTtlSeconds * 1000),
          ipAddress,
        },
        select: { id: true },
      });
    });

    if (deliver) {
      try {
        await this.sms.send(phone, VERIFICATION_SMS[purpose](code));
      } catch (error) {
        // SMS ketmagan kod "qayta yuborish" limitini band qilmasligi kerak
        await this.prisma.verificationCode.delete({ where: { id: created.id } }).catch(() => {});
        throw error;
      }
    }

    return {
      expiresIn: AUTH_LIMITS.codeTtlSeconds,
      resendIn: AUTH_LIMITS.codeResendSeconds,
    };
  }

  /**
   * Kodni tekshiradi va "ishlatilgan" deb belgilaydi. Xato bo'lsa, ApiError tashlaydi.
   * Urinishlar soni atomar oshiriladi — parallel so'rovlar bilan cheklovni aylanib o'tib bo'lmaydi.
   */
  async verify(phone: string, purpose: VerificationPurpose, code: string): Promise<void> {
    const now = new Date();
    const record = await this.prisma.verificationCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt <= now) {
      throw ApiError.badRequest(
        record ? 'CODE_EXPIRED' : 'CODE_INVALID',
        record ? 'Kod muddati tugagan. Yangi kod so‘rang' : 'Kod noto‘g‘ri. Yangi kod so‘rang',
        { errors: [{ field: 'code', message: 'Kod yaroqsiz' }] },
      );
    }

    const attempt = await this.prisma.verificationCode.updateMany({
      where: { id: record.id, consumedAt: null, attempts: { lt: AUTH_LIMITS.codeMaxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (attempt.count === 0) {
      throw ApiError.badRequest(
        'CODE_ATTEMPTS_EXCEEDED',
        'Urinishlar soni tugadi. Yangi kod so‘rang',
        { errors: [{ field: 'code', message: 'Urinishlar soni tugadi' }] },
      );
    }

    if (!this.tokens.verificationCodeMatches(record.codeHash, purpose, phone, code)) {
      const left = AUTH_LIMITS.codeMaxAttempts - (record.attempts + 1);
      const message =
        left > 0
          ? `Kod noto‘g‘ri. Yana ${left} marta urinish mumkin`
          : 'Kod noto‘g‘ri. Yangi kod so‘rang';
      throw ApiError.badRequest('CODE_INVALID', message, {
        errors: [{ field: 'code', message: 'Kod noto‘g‘ri' }],
      });
    }

    const consumed = await this.prisma.verificationCode.updateMany({
      where: { id: record.id, consumedAt: null },
      data: { consumedAt: now },
    });
    if (consumed.count === 0) {
      // Xuddi shu kod parallel so'rovda allaqachon ishlatilgan
      throw ApiError.badRequest('CODE_INVALID', 'Kod allaqachon ishlatilgan. Yangi kod so‘rang');
    }
    this.logger.debug(`Kod tasdiqlandi: ${purpose}`);
  }
}
