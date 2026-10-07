import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { UserRole } from '@santexgo/shared';
import type { Request } from 'express';
import type { RequestUser } from './request-user.js';

export const IS_PUBLIC_KEY = 'santexgo:isPublic';
export const ROLES_KEY = 'santexgo:roles';
export const SKIP_CSRF_KEY = 'santexgo:skipCsrf';

/**
 * Tizimga kirmasdan ochiladigan manzil. Barcha manzillar sukut bo'yicha yopiq.
 * Token bo'lsa, foydalanuvchi baribir aniqlanadi (masalan, sevimlilarni belgilash uchun).
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Faqat ko'rsatilgan rollar uchun. ADMIN uchun rol har safar bazadan qayta tekshiriladi. */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/** Tashqi tizimlar chaqiradigan manzillar (to'lov tizimlari webhook'lari) uchun CSRF tekshiruvi o'chiriladi. */
export const SkipCsrf = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_CSRF_KEY, true);

/** Joriy foydalanuvchi. Faqat yopiq (Public bo'lmagan) manzillarda ishlatiladi. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest<Request>().user;
  if (!user) throw new UnauthorizedException();
  return user;
});

/** Ochiq manzillarda: foydalanuvchi kirgan bo'lsa — uning ma'lumoti, aks holda undefined. */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined =>
    ctx.switchToHttp().getRequest<Request>().user,
);
