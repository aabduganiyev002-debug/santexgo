import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  type AuthUser,
  type LoginData,
  maskUzPhone,
  type PasswordResetData,
  type RegisterData,
  type SendCodeResponse,
} from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import { uniqueViolationTarget } from '../../common/errors/prisma-error.js';
import type { ClientInfo } from '../../common/http/client-info.js';
import { hashPassword, verifyPassword } from '../../common/security/password.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { RateLimitService } from '../../infra/rate-limit/rate-limit.service.js';
import { AUTH_USER_SELECT, type IssuedSession, SessionsService } from './sessions.service.js';
import { TokenService } from './token.service.js';
import { VerificationService } from './verification.service.js';

/** Bir raqamga ketma-ket noto'g'ri parol: shuncha urinishdan keyin vaqtincha bloklanadi */
const LOGIN_MAX_FAILURES = 10;
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;

export interface AuthResult extends IssuedSession {
  accessToken: string;
  accessTokenExpiresAt: Date;
}

/**
 * Foydalanuvchi topilmaganda ham parol tekshiruviga taxminan bir xil vaqt sarflanadi —
 * javob tezligidan raqam ro'yxatdan o'tgan-o'tmaganini bilib bo'lmaydi.
 */
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('santexgo-timing-equalizer');
  return dummyHash;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionsService,
    private readonly verification: VerificationService,
    private readonly counters: RateLimitService,
  ) {}

  // ─────────────────────────── Ro'yxatdan o'tish ───────────────────────────

  async sendRegisterCode(phone: string, client: ClientInfo): Promise<SendCodeResponse> {
    await this.assertPhoneAvailable(phone);
    return this.verification.send(phone, 'REGISTER', { ipAddress: client.ipAddress });
  }

  async register(data: RegisterData, client: ClientInfo): Promise<AuthResult> {
    await this.assertPhoneAvailable(data.phone);
    await this.verification.verify(data.phone, 'REGISTER', data.code);

    const passwordHash = await hashPassword(data.password);
    const now = new Date();
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          passwordHash,
          phoneVerifiedAt: now,
          passwordChangedAt: now,
          lastLoginAt: now,
        },
        select: AUTH_USER_SELECT,
      });
    } catch (error) {
      if (uniqueViolationTarget(error).some((field) => field.includes('phone'))) {
        throw this.phoneTaken();
      }
      throw error;
    }
    this.logger.log(`Yangi mijoz: ${maskUzPhone(user.phone)}`);
    return this.issue(await this.sessions.create(user, client));
  }

  // ─────────────────────────────── Kirish ───────────────────────────────

  async login(data: LoginData, client: ClientInfo): Promise<AuthResult> {
    const failureKey = `login-fail:${data.phone}`;
    const failures = await this.counters.peek(failureKey);
    if (failures && failures.count >= LOGIN_MAX_FAILURES) {
      throw this.tooManyAttempts(failures.resetInMs);
    }

    const user = await this.prisma.user.findUnique({
      where: { phone: data.phone },
      select: { ...AUTH_USER_SELECT, passwordHash: true },
    });
    const passwordOk = user
      ? await verifyPassword(user.passwordHash, data.password)
      : (await verifyPassword(await getDummyHash(), data.password), false);

    if (!user || !passwordOk) {
      const hit = await this.counters.hit(failureKey, LOGIN_LOCK_WINDOW_MS);
      if (hit.count >= LOGIN_MAX_FAILURES) {
        this.logger.warn(
          `Ko‘p noto‘g‘ri parol: ${maskUzPhone(data.phone)}, ip=${client.ipAddress}`,
        );
        throw this.tooManyAttempts(hit.resetInMs);
      }
      throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Telefon raqami yoki parol noto‘g‘ri');
    }
    if (!user.isActive) {
      throw ApiError.forbidden(
        'ACCOUNT_DISABLED',
        'Akkaunt bloklangan. Batafsil ma’lumot uchun do‘kon bilan bog‘laning',
      );
    }

    await this.counters.reset(failureKey);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issue(await this.sessions.create(user, client));
  }

  async refresh(refreshToken: string, client: ClientInfo): Promise<AuthResult> {
    return this.issue(await this.sessions.rotate(refreshToken, client));
  }

  async logout(refreshToken: string | undefined, sessionId: string | undefined): Promise<void> {
    if (refreshToken) await this.sessions.revokeByToken(refreshToken);
    if (sessionId) await this.sessions.revoke(sessionId);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: AUTH_USER_SELECT,
    });
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('SESSION_INVALID', 'Sessiya tugagan. Qayta kiring');
    }
    const { isActive: _isActive, ...authUser } = user;
    return authUser;
  }

  // ─────────────────────────── Parolni tiklash ───────────────────────────

  async sendPasswordResetCode(phone: string, client: ClientInfo): Promise<SendCodeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
      select: { isActive: true },
    });
    // Ro'yxatdan o'tmagan raqamga ham bir xil javob — raqamlar bazasini aniqlab bo'lmaydi
    return this.verification.send(phone, 'RESET_PASSWORD', {
      ipAddress: client.ipAddress,
      deliver: Boolean(user?.isActive),
    });
  }

  async resetPassword(data: PasswordResetData, client: ClientInfo): Promise<AuthResult> {
    await this.verification.verify(data.phone, 'RESET_PASSWORD', data.code);
    const user = await this.prisma.user.findUnique({
      where: { phone: data.phone },
      select: AUTH_USER_SELECT,
    });
    if (!user || !user.isActive) {
      throw ApiError.badRequest('CODE_INVALID', 'Kod noto‘g‘ri. Yangi kod so‘rang');
    }

    const passwordHash = await hashPassword(data.password);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date(), lastLoginAt: new Date() },
    });
    // Boshqa qurilmalardagi barcha sessiyalar yopiladi (parol o'g'irlangan bo'lishi mumkin)
    await this.sessions.revokeAllForUser(user.id);
    await this.counters.reset(`login-fail:${user.phone}`);
    this.logger.log(`Parol tiklandi: ${maskUzPhone(user.phone)}`);
    return this.issue(await this.sessions.create(user, client));
  }

  // ─────────────────────────────── Yordamchi ───────────────────────────────

  private async issue(session: IssuedSession): Promise<AuthResult> {
    const access = await this.tokens.signAccessToken(session.user, session.sessionId);
    return { ...session, accessToken: access.token, accessTokenExpiresAt: access.expiresAt };
  }

  private async assertPhoneAvailable(phone: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (existing) throw this.phoneTaken();
  }

  private phoneTaken(): ApiError {
    return new ApiError(
      HttpStatus.CONFLICT,
      'PHONE_TAKEN',
      'Bu raqam allaqachon ro‘yxatdan o‘tgan. Kiring yoki parolni tiklang',
      { errors: [{ field: 'phone', message: 'Bu raqam allaqachon ro‘yxatdan o‘tgan' }] },
    );
  }

  private tooManyAttempts(resetInMs: number): ApiError {
    const retryAfter = Math.max(1, Math.ceil(resetInMs / 1000));
    const minutes = Math.ceil(retryAfter / 60);
    return ApiError.tooManyRequests(
      'TOO_MANY_LOGIN_ATTEMPTS',
      `Juda ko‘p noto‘g‘ri urinish. ${minutes} daqiqadan keyin qayta urinib ko‘ring yoki parolni tiklang`,
      retryAfter,
    );
  }
}
