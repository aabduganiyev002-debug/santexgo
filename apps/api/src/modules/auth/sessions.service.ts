import { Injectable, Logger } from '@nestjs/common';
import type { AuthUser } from '@santexgo/shared';
import type { ClientInfo } from '../../common/http/client-info.js';
import { ApiError } from '../../common/errors/api-error.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { TokenService } from './token.service.js';

/**
 * Bir vaqtda ochilgan bir nechta tab bitta refresh token bilan bir zumda yangilanishga urinsa,
 * birinchisi tokenni almashtiradi, qolganlari shu muddat ichida eski token bilan ham o'tadi.
 */
const ROTATION_GRACE_MS = 30_000;

export const AUTH_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
} as const;

export interface IssuedSession {
  sessionId: string;
  user: AuthUser;
  /** null — token almashtirilmadi (parallel so'rov), brauzerdagi cookie o'zgarmaydi */
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
}

function toAuthUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: AuthUser['role'];
}): AuthUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
  };
}

const invalidSession = (): ApiError =>
  ApiError.unauthorized('SESSION_INVALID', 'Sessiya tugagan. Qayta kiring');

/** Login sessiyalari: yaratish, refresh token almashtirish (rotation), yopish. */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async create(user: Parameters<typeof toAuthUser>[0], client: ClientInfo): Promise<IssuedSession> {
    const refresh = this.tokens.generateRefreshToken();
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: refresh.hash,
        expiresAt: refresh.expiresAt,
        ipAddress: client.ipAddress,
        userAgent: client.userAgent,
      },
      select: { id: true },
    });
    return {
      sessionId: session.id,
      user: toAuthUser(user),
      refreshToken: refresh.token,
      refreshTokenExpiresAt: refresh.expiresAt,
    };
  }

  /**
   * Refresh token'ni yangisiga almashtiradi. Eski token (ishlatilgan) qayta kelsa —
   * u o'g'irlangan bo'lishi mumkin, shuning uchun butun sessiya yopiladi.
   */
  async rotate(refreshToken: string, client: ClientInfo): Promise<IssuedSession> {
    const hash = this.tokens.hashRefreshToken(refreshToken);
    const now = new Date();

    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: { select: AUTH_USER_SELECT } },
    });

    if (session) {
      if (session.revokedAt || session.expiresAt <= now) throw invalidSession();
      if (!session.user.isActive) {
        await this.revoke(session.id);
        throw ApiError.forbidden('ACCOUNT_DISABLED', 'Akkaunt bloklangan');
      }
      const next = this.tokens.generateRefreshToken();
      const updated = await this.prisma.session.updateMany({
        where: { id: session.id, refreshTokenHash: hash, revokedAt: null },
        data: {
          refreshTokenHash: next.hash,
          previousTokenHash: hash,
          rotatedAt: now,
          lastUsedAt: now,
          expiresAt: next.expiresAt,
          ipAddress: client.ipAddress,
          userAgent: client.userAgent,
        },
      });
      if (updated.count === 1) {
        return {
          sessionId: session.id,
          user: toAuthUser(session.user),
          refreshToken: next.token,
          refreshTokenExpiresAt: next.expiresAt,
        };
      }
      // Parallel so'rov tokenni bizdan oldin almashtirdi — pastdagi "grace" yo'li tekshiradi
    }

    const previous = await this.prisma.session.findFirst({
      where: { previousTokenHash: hash },
      include: { user: { select: AUTH_USER_SELECT } },
    });
    if (!previous || previous.revokedAt || previous.expiresAt <= now) throw invalidSession();

    const withinGrace =
      previous.rotatedAt !== null &&
      now.getTime() - previous.rotatedAt.getTime() <= ROTATION_GRACE_MS;
    if (!withinGrace) {
      this.logger.warn(
        `Ishlatilgan refresh token qayta keldi — sessiya yopildi (session=${previous.id}, ip=${client.ipAddress})`,
      );
      await this.revoke(previous.id);
      throw invalidSession();
    }
    if (!previous.user.isActive) throw ApiError.forbidden('ACCOUNT_DISABLED', 'Akkaunt bloklangan');

    return {
      sessionId: previous.id,
      user: toAuthUser(previous.user),
      refreshToken: null,
      refreshTokenExpiresAt: null,
    };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Chiqish: token bo'yicha sessiyani yopadi (token noto'g'ri bo'lsa — jim). */
  async revokeByToken(refreshToken: string): Promise<void> {
    const hash = this.tokens.hashRefreshToken(refreshToken);
    await this.prisma.session.updateMany({
      where: { OR: [{ refreshTokenHash: hash }, { previousTokenHash: hash }], revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Parol o'zgarganda yoki "barcha qurilmalardan chiqish"da. */
  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /** Admin API'lari uchun: sessiya hali ochiqmi va foydalanuvchi shu rolda faolmi. */
  async isActive(sessionId: string, userId: string, role: AuthUser['role']): Promise<boolean> {
    const count = await this.prisma.session.count({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { isActive: true, role },
      },
    });
    return count === 1;
  }
}
