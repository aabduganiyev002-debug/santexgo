import type { UserRole } from '@santexgo/shared';

/** Access token'dan olingan joriy foydalanuvchi (bazaga murojaatsiz). */
export interface RequestUser {
  id: string;
  role: UserRole;
  sessionId: string;
}
