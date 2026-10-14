import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@santexgo/shared';
import type { Request } from 'express';
import { ROLES_KEY } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import { SessionsService } from '../sessions.service.js';

/**
 * @Roles('ADMIN') — faqat shu rol uchun. Token ichidagi rolga to'liq ishonilmaydi:
 * sessiya ochiqligi, akkaunt faolligi va rol har so'rovda bazadan tekshiriladi
 * (admin huquqi olib tashlansa yoki bloklansa — darhol kuchga kiradi).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request>().user;
    if (!user) throw ApiError.unauthorized('UNAUTHORIZED', 'Avval tizimga kiring');
    if (!roles.includes(user.role)) {
      throw ApiError.forbidden('FORBIDDEN', 'Bu bo‘lim uchun ruxsat yo‘q');
    }
    if (!(await this.sessions.isActive(user.sessionId, user.id, user.role))) {
      throw ApiError.unauthorized('SESSION_INVALID', 'Sessiya tugagan. Qayta kiring');
    }
    return true;
  }
}
