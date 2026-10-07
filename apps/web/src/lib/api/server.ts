import 'server-only';
import { notFound } from 'next/navigation';
import { ApiRequestError } from './errors';

const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000').replace(
  /\/+$/,
  '',
);

interface ServerGetOptions {
  /** Necha soniya keshlanadi (0 — keshlanmaydi) */
  revalidate?: number;
  /** 404 bo'lsa Next.js "topilmadi" sahifasini ko'rsatish */
  notFoundOn404?: boolean;
}

/**
 * Sahifa serverda tayyorlanayotganda API'dan ma'lumot olish.
 * Katalog ma'lumotlari qisqa muddat keshlanadi — sahifalar tez ochiladi, API yuklanmaydi.
 */
export async function serverGet<T>(path: string, options: ServerGetOptions = {}): Promise<T> {
  const { revalidate = 60, notFoundOn404 = true } = options;
  let response: Response;
  try {
    response = await fetch(`${API_INTERNAL_URL}/api/v1${path}`, {
      headers: { accept: 'application/json' },
      ...(revalidate > 0 ? { next: { revalidate } } : { cache: 'no-store' }),
    });
  } catch (error) {
    throw new Error(
      `API bilan ulanib bo‘lmadi (${API_INTERNAL_URL}): ${(error as Error).message}`,
      {
        cause: error,
      },
    );
  }
  if (response.status === 404 && notFoundOn404) notFound();
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiRequestError(response.status, body);
  }
  return (await response.json()) as T;
}
