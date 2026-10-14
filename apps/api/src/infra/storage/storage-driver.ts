export interface PutObjectOptions {
  contentType: string;
  /** Fayl nomi tasodifiy bo'lgani uchun brauzer uni uzoq keshlaydi */
  cacheControl?: string;
}

/** Fayl saqlash joyi: lokal disk yoki S3-mos xizmat (Cloudflare R2, AWS S3, SeaweedFS, MinIO). */
export abstract class StorageDriver {
  abstract readonly name: string;
  abstract put(key: string, body: Buffer, options: PutObjectOptions): Promise<void>;
  abstract delete(keys: string[]): Promise<void>;
  /** Ishga tushganda tekshiruv (masalan, S3 bucket mavjudligi) */
  init(): Promise<void> {
    return Promise.resolve();
  }
}

export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/** Kalit faqat xavfsiz belgilardan iborat bo'lishi kerak (../ orqali boshqa papkaga chiqib bo'lmaydi). */
export function assertSafeKey(key: string): void {
  if (!/^[a-z0-9][a-z0-9/_.-]{0,250}$/i.test(key) || key.includes('..') || key.includes('//')) {
    throw new Error(`Noto‘g‘ri fayl kaliti: ${key}`);
  }
}
