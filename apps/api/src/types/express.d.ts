import type { RequestUser } from '../common/auth/request-user.js';

declare global {
  namespace Express {
    interface Request {
      /** AuthGuard tomonidan to'ldiriladi (token yaroqli bo'lsa) */
      user?: RequestUser;
    }
  }
}

export {};
