import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { USER_ROLES, type UserRole } from '@santexgo/shared';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';
import type { RequestUser } from '../../common/auth/request-user.js';
import { ApiError } from '../../common/errors/api-error.js';
import type { Env } from '../../config/env.schema.js';

const ISSUER = 'santexgo';
const AUDIENCE = 'santexgo-api';
const REFRESH_TOKEN_BYTES = 32;

/** Bitta AUTH_SECRET dan har bir maqsad uchun alohida kalit hosil qilinadi. */
function deriveKey(secret: string, purpose: string): Buffer {
  return createHmac('sha256', secret).update(`santexgo:${purpose}`).digest();
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface SignedToken {
  token: string;
  expiresAt: Date;
}

/**
 * Tokenlar: access — qisqa muddatli JWT (bazaga murojaatsiz tekshiriladi);
 * refresh — tasodifiy satr, bazada faqat SHA-256 xeshi saqlanadi.
 */
@Injectable()
export class TokenService {
  private readonly accessKey: Uint8Array;
  private readonly codeKey: Buffer;
  private readonly accessTtlMs: number;
  readonly refreshTtlMs: number;

  constructor(config: ConfigService<Env, true>) {
    const secret = config.get('AUTH_SECRET', { infer: true });
    this.accessKey = new Uint8Array(deriveKey(secret, 'access-token'));
    this.codeKey = deriveKey(secret, 'verification-code');
    this.accessTtlMs = config.get('ACCESS_TOKEN_TTL_MINUTES', { infer: true }) * 60_000;
    this.refreshTtlMs = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 86_400_000;
  }

  async signAccessToken(
    user: { id: string; role: UserRole },
    sessionId: string,
  ): Promise<SignedToken> {
    const expiresAt = new Date(Date.now() + this.accessTtlMs);
    const token = await new SignJWT({ role: user.role, sid: sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.accessKey);
    return { token, expiresAt };
  }

  async verifyAccessToken(token: string): Promise<RequestUser> {
    try {
      const { payload } = await jwtVerify(token, this.accessKey, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      const { sub, role, sid } = payload;
      if (
        typeof sub !== 'string' ||
        typeof sid !== 'string' ||
        !USER_ROLES.includes(role as UserRole)
      ) {
        throw new Error('Token tarkibi noto‘g‘ri');
      }
      return { id: sub, role: role as UserRole, sessionId: sid };
    } catch (error) {
      if (error instanceof joseErrors.JWTExpired) {
        throw ApiError.unauthorized('TOKEN_EXPIRED', 'Sessiya muddati tugadi');
      }
      throw ApiError.unauthorized('UNAUTHORIZED', 'Avval tizimga kiring');
    }
  }

  generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    return { token, hash: sha256(token), expiresAt: new Date(Date.now() + this.refreshTtlMs) };
  }

  hashRefreshToken(token: string): string {
    return sha256(token);
  }

  /** SMS kod xeshi: maxfiy kalit bilan (6 xonali kodni bazadan tiklab bo'lmaydi). */
  hashVerificationCode(purpose: string, phone: string, code: string): string {
    return createHmac('sha256', this.codeKey).update(`${purpose}:${phone}:${code}`).digest('hex');
  }

  verificationCodeMatches(hash: string, purpose: string, phone: string, code: string): boolean {
    const expected = Buffer.from(this.hashVerificationCode(purpose, phone, code), 'hex');
    const actual = Buffer.from(hash, 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
