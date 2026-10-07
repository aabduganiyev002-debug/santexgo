import type { ApiErrorBody, ApiErrorCode, ApiFieldError } from '@santexgo/shared';

/** API xatosi: status, barqaror kod va foydalanuvchiga ko'rsatiladigan o'zbekcha matn. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly errors: ApiFieldError[];
  readonly retryAfter?: number;

  constructor(status: number, body: Partial<ApiErrorBody> | null) {
    super(body?.message ?? 'Xatolik yuz berdi. Qayta urinib ko‘ring');
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = body?.code ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
    this.errors = body?.errors ?? [];
    this.retryAfter = body?.retryAfter;
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiRequestError {
  return error instanceof ApiRequestError && (code === undefined || error.code === code);
}

/** Har qanday xatodan foydalanuvchiga ko'rsatiladigan matn. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return 'Internet aloqasini tekshiring va qayta urinib ko‘ring';
}
