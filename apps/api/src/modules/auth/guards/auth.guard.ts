import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { readAccessToken } from '../auth.cookies.js';
import { TokenService } from '../token.service.js';

/**
 * Global guard: barcha manzillar sukut bo'yicha faqat kirgan foydalanuvchi uchun.
 * @Public() manzillarda token ixtiyoriy: yaroqli bo'lsa foydalanuvchi aniqlanadi,
 * yaroqsiz bo'lsa — so'rov mehmon sifatida davom etadi.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;
    const req = context.switchToHttp().getRequest<Request>();

    const token = readAccessToken(req);
    if (token) {
      try {
        req.user = await this.tokens.verifyAccessToken(token);
      } catch (error) {
        if (!isPublic) throw error;
      }
    }
    if (!isPublic && !req.user) {
      throw ApiError.unauthorized('UNAUTHORIZED', 'Avval tizimga kiring');
    }
    return true;
  }
}
