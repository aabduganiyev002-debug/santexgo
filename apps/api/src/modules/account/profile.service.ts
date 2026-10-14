import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ACTIVE_ORDER_STATUSES,
  type AccountOverview,
  type AuthUser,
  maskUzPhone,
  type SendCodeResponse,
} from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import { isUniqueViolation } from '../../common/errors/prisma-error.js';
import type { ClientInfo } from '../../common/http/client-info.js';
import { hashPassword, verifyPassword } from '../../common/security/password.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RateLimitService } from '../../infra/rate-limit/rate-limit.service.js';
import { SessionsService } from '../auth/sessions.service.js';
import { VerificationService } from '../auth/verification.service.js';
import { ORDER_SUMMARY_SELECT, OrderPresenter } from '../orders/order.presenter.js';
import { toAddressView } from './addresses.service.js';

const USER_SELECT = { id: true, firstName: true, lastName: true, phone: true, role: true } as const;

/** Joriy parolni noto'g'ri kiritish: shuncha urinishdan keyin vaqtincha to'xtatiladi */
const PASSWORD_MAX_FAILURES = 5;
const PASSWORD_LOCK_MS = 15 * 60 * 1000;

/** Shaxsiy kabinet: umumiy ma'lumot, profil, parol va telefon raqamini o'zgartirish. */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly verification: VerificationService,
    private readonly counters: RateLimitService,
    private readonly presenter: OrderPresenter,
  ) {}

  async overview(userId: string): Promise<AccountOverview> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, phone: true, createdAt: true },
    });
    const active = { userId, status: { in: [...ACTIVE_ORDER_STATUSES] } };
    const [ordersCount, activeOrdersCount, delivered, activeOrders, favoritesCount, addresses] =
      await this.prisma.$transaction([
        this.prisma.order.count({ where: { userId } }),
        this.prisma.order.count({ where: active }),
        this.prisma.order.aggregate({
          where: { userId, status: 'DELIVERED' },
          _count: { _all: true },
          _sum: { total: true },
        }),
        this.prisma.order.findMany({
          where: active,
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: ORDER_SUMMARY_SELECT,
        }),
        this.prisma.favorite.count({
          where: { userId, product: { isActive: true, brand: { isActive: true } } },
        }),
        this.prisma.address.findMany({
          where: { userId },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        }),
      ]);
    return {
      user: { ...user, createdAt: user.createdAt.toISOString() },
      stats: {
        ordersCount,
        activeOrdersCount,
        deliveredCount: delivered._count._all,
        totalSpent: delivered._sum.total ?? 0,
      },
      activeOrders: activeOrders.map((row) => this.presenter.summary(row)),
      favoritesCount,
      addresses: addresses.map(toAddressView),
    };
  }

  async updateProfile(
    userId: string,
    input: { firstName: string; lastName: string },
  ): Promise<AuthUser> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { firstName: input.firstName, lastName: input.lastName },
      select: USER_SELECT,
    });
  }

  /** Parolni o'zgartirish: joriy parol tekshiriladi, boshqa qurilmalardagi sessiyalar yopiladi. */
  async changePassword(
    userId: string,
    sessionId: string,
    input: { currentPassword: string; password: string },
  ): Promise<void> {
    const failureKey = `password-fail:${userId}`;
    const failures = await this.counters.peek(failureKey);
    if (failures && failures.count >= PASSWORD_MAX_FAILURES) {
      throw this.tooManyAttempts(failures.resetInMs);
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, phone: true },
    });
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      const hit = await this.counters.hit(failureKey, PASSWORD_LOCK_MS);
      if (hit.count >= PASSWORD_MAX_FAILURES) throw this.tooManyAttempts(hit.resetInMs);
      throw ApiError.field(
        HttpStatus.BAD_REQUEST,
        'PASSWORD_INCORRECT',
        'currentPassword',
        'Joriy parol noto‘g‘ri',
      );
    }
    await this.counters.reset(failureKey);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() },
    });
    const closed = await this.sessions.revokeAllForUser(userId, sessionId);
    this.logger.log(
      `Parol o‘zgartirildi: ${maskUzPhone(user.phone)}, boshqa qurilmalardan chiqildi: ${closed}`,
    );
  }

  /** Yangi raqamga tasdiqlash kodi. Raqam boshqa akkauntda bo'lsa — kod yuborilmaydi. */
  async sendPhoneCode(
    userId: string,
    phone: string,
    client: ClientInfo,
  ): Promise<SendCodeResponse> {
    await this.assertPhoneAvailable(userId, phone);
    return this.verification.send(phone, 'CHANGE_PHONE', { ipAddress: client.ipAddress });
  }

  async changePhone(userId: string, input: { phone: string; code: string }): Promise<AuthUser> {
    await this.assertPhoneAvailable(userId, input.phone);
    await this.verification.verify(input.phone, 'CHANGE_PHONE', input.code);
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { phone: input.phone, phoneVerifiedAt: new Date() },
        select: USER_SELECT,
      });
      this.logger.log(`Telefon raqami o‘zgartirildi: ${maskUzPhone(input.phone)}`);
      return user;
    } catch (error) {
      if (isUniqueViolation(error)) throw this.phoneTaken();
      throw error;
    }
  }

  private async assertPhoneAvailable(userId: string, phone: string): Promise<void> {
    const owner = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (owner?.id === userId) {
      throw ApiError.field(
        HttpStatus.BAD_REQUEST,
        'BAD_REQUEST',
        'phone',
        'Bu sizning hozirgi raqamingiz',
      );
    }
    if (owner) throw this.phoneTaken();
  }

  private phoneTaken(): ApiError {
    return ApiError.field(
      HttpStatus.CONFLICT,
      'PHONE_TAKEN',
      'phone',
      'Bu raqam boshqa akkauntga biriktirilgan',
    );
  }

  private tooManyAttempts(resetInMs: number): ApiError {
    const retryAfter = Math.max(1, Math.ceil(resetInMs / 1000));
    return ApiError.tooManyRequests(
      'TOO_MANY_LOGIN_ATTEMPTS',
      `Parol ko‘p marta noto‘g‘ri kiritildi. ${Math.ceil(retryAfter / 60)} daqiqadan keyin qayta urinib ko‘ring`,
      retryAfter,
    );
  }
}
