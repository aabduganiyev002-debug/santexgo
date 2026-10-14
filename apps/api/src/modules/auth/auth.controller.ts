import { Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  AUTH_MODE_HEADER,
  type AuthResponse,
  type AuthUser,
  loginSchema,
  type LoginData,
  passwordResetSchema,
  type PasswordResetData,
  refreshTokenSchema,
  registerSchema,
  type RegisterData,
  sendCodeSchema,
  type SendCodeResponse,
} from '@santexgo/shared';
import type { Request, Response } from 'express';
import { CurrentUser, Public } from '../../common/auth/decorators.js';
import type { RequestUser } from '../../common/auth/request-user.js';
import { ApiError } from '../../common/errors/api-error.js';
import { clientInfo } from '../../common/http/client-info.js';
import { ZodBody } from '../../common/validation/zod-validation.js';
import { AuthCookies } from './auth.cookies.js';
import { type AuthResult, AuthService } from './auth.service.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** SMS yuboriladigan manzillar: IP bo'yicha soatiga (CGNAT — ko'p mijoz bitta IP'da bo'lishi mumkin) */
const SEND_CODE_LIMIT = { default: { limit: 30, ttl: HOUR } };
const LOGIN_LIMIT = { default: { limit: 30, ttl: 5 * MINUTE } };
const VERIFY_LIMIT = { default: { limit: 30, ttl: 10 * MINUTE } };

const authModeHeader = ApiHeader({
  name: AUTH_MODE_HEADER,
  required: false,
  description:
    '"token" — tokenlar cookie o‘rniga javob tanasida qaytadi (mobil ilova, bot). Brauzer uchun bermang.',
});

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
  ) {}

  @Public()
  @Throttle(SEND_CODE_LIMIT)
  @Post('register/send-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ro‘yxatdan o‘tish: telefonga SMS kod yuborish' })
  sendRegisterCode(
    @ZodBody(sendCodeSchema) body: { phone: string },
    @Req() req: Request,
  ): Promise<SendCodeResponse> {
    return this.auth.sendRegisterCode(body.phone, clientInfo(req));
  }

  @Public()
  @Throttle(VERIFY_LIMIT)
  @Post('register')
  @authModeHeader
  @ApiOperation({ summary: 'Ro‘yxatdan o‘tish: SMS kod bilan akkaunt yaratish va kirish' })
  async register(
    @ZodBody(registerSchema) body: RegisterData,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(req, res, await this.auth.register(body, clientInfo(req)));
  }

  @Public()
  @Throttle(LOGIN_LIMIT)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @authModeHeader
  @ApiOperation({ summary: 'Kirish: telefon va parol' })
  async login(
    @ZodBody(loginSchema) body: LoginData,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(req, res, await this.auth.login(body, clientInfo(req)));
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: MINUTE } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @authModeHeader
  @ApiOperation({
    summary: 'Sessiyani yangilash (access token muddati tugaganda)',
    description:
      'Brauzer: refresh token cookie’da avtomatik yuboriladi. Token rejimi: tanada refreshToken.',
  })
  async refresh(
    @ZodBody(refreshTokenSchema) body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const token = this.isTokenMode(req) ? body.refreshToken : this.cookies.readRefreshToken(req);
    if (!token) {
      this.cookies.clear(res);
      throw ApiError.unauthorized('SESSION_INVALID', 'Sessiya tugagan. Qayta kiring');
    }
    try {
      return this.respond(req, res, await this.auth.refresh(token, clientInfo(req)));
    } catch (error) {
      if (!this.isTokenMode(req)) this.cookies.clear(res);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Chiqish (joriy qurilmada)' })
  @ApiNoContentResponse()
  async logout(
    @ZodBody(refreshTokenSchema) body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = this.isTokenMode(req) ? body.refreshToken : this.cookies.readRefreshToken(req);
    await this.auth.logout(token, req.user?.sessionId);
    this.cookies.clear(res);
  }

  @Public()
  @Throttle(SEND_CODE_LIMIT)
  @Post('password-reset/send-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Parolni tiklash: SMS kod yuborish',
    description: 'Raqam ro‘yxatdan o‘tmagan bo‘lsa ham javob bir xil (xavfsizlik uchun).',
  })
  sendPasswordResetCode(
    @ZodBody(sendCodeSchema) body: { phone: string },
    @Req() req: Request,
  ): Promise<SendCodeResponse> {
    return this.auth.sendPasswordResetCode(body.phone, clientInfo(req));
  }

  @Public()
  @Throttle(VERIFY_LIMIT)
  @Post('password-reset')
  @HttpCode(HttpStatus.OK)
  @authModeHeader
  @ApiOperation({
    summary: 'Parolni tiklash: SMS kod va yangi parol (boshqa qurilmalardan chiqariladi)',
  })
  async resetPassword(
    @ZodBody(passwordResetSchema) body: PasswordResetData,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(req, res, await this.auth.resetPassword(body, clientInfo(req)));
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Joriy foydalanuvchi' })
  @ApiOkResponse({ description: 'Kirgan foydalanuvchi ma’lumotlari' })
  me(@CurrentUser() user: RequestUser): Promise<AuthUser> {
    return this.auth.me(user.id);
  }

  private isTokenMode(req: Request): boolean {
    return req.header(AUTH_MODE_HEADER) === 'token';
  }

  private respond(req: Request, res: Response, result: AuthResult): AuthResponse {
    const response: AuthResponse = {
      user: result.user,
      accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
    };
    if (this.isTokenMode(req)) {
      response.accessToken = result.accessToken;
      if (result.refreshToken && result.refreshTokenExpiresAt) {
        response.refreshToken = result.refreshToken;
        response.refreshTokenExpiresAt = result.refreshTokenExpiresAt.toISOString();
      }
    } else {
      this.cookies.set(res, result);
    }
    res.setHeader('Cache-Control', 'no-store');
    return response;
  }
}
