/**
 * API xatolarining barqaror kodlari. Frontend xabar matniga emas, shu kodlarga tayanadi.
 */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'CSRF_REJECTED',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  // Auth
  'PHONE_TAKEN',
  'INVALID_CREDENTIALS',
  'ACCOUNT_DISABLED',
  'TOO_MANY_LOGIN_ATTEMPTS',
  'CODE_INVALID',
  'CODE_EXPIRED',
  'CODE_ATTEMPTS_EXCEEDED',
  'CODE_RESEND_TOO_SOON',
  'SMS_LIMIT_REACHED',
  'SMS_SEND_FAILED',
  'SESSION_INVALID',
  'PASSWORD_INCORRECT',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiFieldError {
  /** Maydon yo'li nuqta bilan: "items.0.quantity" */
  field: string;
  message: string;
}

/** Barcha xatolar shu ko'rinishda qaytadi. */
export interface ApiErrorBody {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  /** Validatsiya xatolari (forma maydonlari bo'yicha) */
  errors?: ApiFieldError[];
  /** Necha soniyadan keyin qayta urinish mumkin (429 uchun) */
  retryAfter?: number;
  requestId?: string;
}
