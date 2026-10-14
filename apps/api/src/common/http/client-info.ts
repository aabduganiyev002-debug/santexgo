import type { Request } from 'express';

export interface ClientInfo {
  ipAddress: string | null;
  userAgent: string | null;
}

/** Mijozning IP manzili (trust proxy sozlamasiga ko'ra) va brauzer ma'lumoti. */
export function clientInfo(req: Request): ClientInfo {
  const ip = req.ip ?? null;
  const userAgent = req.header('user-agent') ?? null;
  return {
    ipAddress: ip ? ip.replace(/^::ffff:/, '').slice(0, 45) : null,
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
  };
}
