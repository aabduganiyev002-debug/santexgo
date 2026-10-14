import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { isPrivateAddress } from '../../common/http/private-address.js';

/**
 * IP bo'yicha limit. Ichki tarmoqdan to'g'ridan-to'g'ri kelgan so'rovlar (sayt serverining
 * sahifa tayyorlash so'rovlari, proksisiz) cheklanmaydi — aks holda barcha mijozlarning
 * sahifalari bitta IP limitini bo'lishib qolardi. Proksi (Caddy, Next.js) orqali kelgan
 * so'rovlarda X-Forwarded-For bor — ular mijozning haqiqiy IP'si bo'yicha cheklanadi.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const direct = !req.headers['x-forwarded-for'] && !req.headers['x-real-ip'];
    return Promise.resolve(direct && isPrivateAddress(req.socket.remoteAddress));
  }
}
