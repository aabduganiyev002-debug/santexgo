'use client';

import { AUTH_COOKIES } from '@santexgo/shared';
import { ApiRequestError } from './errors';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Sessiya tugaganda avtomatik yangilashni o'chirish (auth so'rovlarining o'zi uchun) */
  skipRefresh?: boolean;
}

/** Kirgan foydalanuvchi belgisi (maxfiy emas — faqat UI uchun). */
export function hasSessionHint(): boolean {
  return typeof document !== 'undefined' && document.cookie.includes(`${AUTH_COOKIES.hint}=1`);
}

let refreshing: Promise<boolean> | null = null;
const sessionListeners = new Set<() => void>();

/** Sessiya tugaganda (refresh ham ishlamasa) chaqiriladi — masalan, kabinetdan chiqarish uchun. */
export function onSessionExpired(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

/** Access token muddati tugaganda bir marta yangilaydi (parallel so'rovlar bitta yangilashni kutadi). */
function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => {
        refreshing = null;
      }, 0);
    });
  return refreshing;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const hasBody = options.body !== undefined && !(options.body instanceof FormData);
  return fetch(`/api/v1${path}`, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
    },
    body:
      options.body instanceof FormData
        ? options.body
        : hasBody
          ? JSON.stringify(options.body)
          : undefined,
    signal: options.signal,
  });
}

/** Brauzerdan API so'rovi: cookie bilan, xatolar ApiRequestError sifatida. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401 && !options.skipRefresh && hasSessionHint()) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { code?: string } | null;
    if (body?.code === 'TOKEN_EXPIRED' || body?.code === 'UNAUTHORIZED') {
      if (await refreshSession()) {
        response = await send(path, options);
      } else {
        sessionListeners.forEach((listener) => listener());
      }
    }
  }

  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw new ApiRequestError(response.status, data as never);
  return data as T;
}
