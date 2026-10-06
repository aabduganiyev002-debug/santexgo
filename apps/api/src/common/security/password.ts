import { hash, verify } from '@node-rs/argon2';

/**
 * Parollar Argon2id bilan xeshlanadi (kutubxonaning standart algoritmi).
 * Parametrlar OWASP tavsiyasiga mos: 19 MiB xotira, 2 iteratsiya, 1 oqim.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
/** Admin akkauntlari uchun qattiqroq talab */
export const ADMIN_PASSWORD_MIN_LENGTH = 10;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/** Xesh noto'g'ri formatda bo'lsa ham xato tashlamaydi — shunchaki false qaytaradi. */
export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}
