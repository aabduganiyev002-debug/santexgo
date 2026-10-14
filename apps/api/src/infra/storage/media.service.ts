import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ImageUrls } from '@santexgo/shared';
import { ApiError } from '../../common/errors/api-error.js';
import type { Env } from '../../config/env.schema.js';
import { InvalidImageError, isPdf, processImage, processSingleImage } from './image-processor.js';
import { IMMUTABLE_CACHE, StorageDriver } from './storage-driver.js';

export interface StoredImage {
  /** Saqlash kalitlari (bazaga yoziladi); to'liq URL javobda hosil qilinadi */
  url: string;
  mediumUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
}

const ABSOLUTE_URL = /^https?:\/\//i;

/**
 * Rasm va hujjatlarni saqlash. Bazada fayl kaliti saqlanadi ("products/<id>/<uuid>-l.webp"),
 * mijozga to'liq manzil beriladi (MEDIA_PUBLIC_URL + kalit) — domen o'zgarsa, baza o'zgarmaydi.
 */
@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private readonly publicBase: string;

  constructor(
    private readonly driver: StorageDriver,
    config: ConfigService<Env, true>,
  ) {
    this.publicBase = config.get('MEDIA_PUBLIC_URL', { infer: true }).replace(/\/+$/, '');
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.driver.init();
      this.logger.log(`Fayllar saqlanadi: ${this.driver.name}`);
    } catch (error) {
      this.logger.error(`Fayl saqlash joyi tayyor emas: ${(error as Error).message}`);
    }
  }

  /** Kalit yoki tashqi URL → mijoz uchun to'liq manzil. */
  url(keyOrUrl: string): string {
    return ABSOLUTE_URL.test(keyOrUrl) ? keyOrUrl : `${this.publicBase}/${keyOrUrl}`;
  }

  urlOrNull(keyOrUrl: string | null | undefined): string | null {
    return keyOrUrl ? this.url(keyOrUrl) : null;
  }

  imageUrls(image: {
    url: string;
    mediumUrl: string | null;
    thumbUrl: string | null;
    alt: string | null;
  }): ImageUrls {
    const url = this.url(image.url);
    return {
      url,
      medium: image.mediumUrl ? this.url(image.mediumUrl) : url,
      thumb: image.thumbUrl ? this.url(image.thumbUrl) : url,
      alt: image.alt,
    };
  }

  async saveImage(prefix: string, input: Buffer): Promise<StoredImage> {
    let processed;
    try {
      processed = await processImage(input);
    } catch (error) {
      if (error instanceof InvalidImageError) {
        throw ApiError.badRequest('FILE_INVALID', error.message);
      }
      throw error;
    }
    const id = randomUUID();
    const keys = {
      url: `${prefix}/${id}-l.webp`,
      mediumUrl: `${prefix}/${id}-m.webp`,
      thumbUrl: `${prefix}/${id}-t.webp`,
    };
    const options = { contentType: 'image/webp', cacheControl: IMMUTABLE_CACHE };
    try {
      await Promise.all([
        this.driver.put(keys.url, processed.large, options),
        this.driver.put(keys.mediumUrl, processed.medium, options),
        this.driver.put(keys.thumbUrl, processed.thumb, options),
      ]);
    } catch (error) {
      await this.remove(Object.values(keys));
      this.logger.error(`Rasm saqlanmadi: ${(error as Error).message}`);
      throw ApiError.serviceUnavailable('SERVICE_UNAVAILABLE', 'Faylni saqlab bo‘lmadi');
    }
    return { ...keys, width: processed.width, height: processed.height };
  }

  /** Bitta o'lchamli rasm (brend logotipi, kategoriya rasmi, banner). Saqlash kalitini qaytaradi. */
  async saveSingleImage(prefix: string, input: Buffer, maxSize: number): Promise<string> {
    let processed;
    try {
      processed = await processSingleImage(input, maxSize);
    } catch (error) {
      if (error instanceof InvalidImageError) {
        throw ApiError.badRequest('FILE_INVALID', error.message);
      }
      throw error;
    }
    const key = `${prefix}/${randomUUID()}.webp`;
    try {
      await this.driver.put(key, processed, {
        contentType: 'image/webp',
        cacheControl: IMMUTABLE_CACHE,
      });
    } catch (error) {
      this.logger.error(`Rasm saqlanmadi: ${(error as Error).message}`);
      throw ApiError.serviceUnavailable('SERVICE_UNAVAILABLE', 'Faylni saqlab bo‘lmadi');
    }
    return key;
  }

  async saveDocument(prefix: string, input: Buffer): Promise<string> {
    if (!isPdf(input)) {
      throw ApiError.badRequest('FILE_INVALID', 'Faqat PDF fayl yuklash mumkin');
    }
    const key = `${prefix}/${randomUUID()}.pdf`;
    try {
      await this.driver.put(key, input, {
        contentType: 'application/pdf',
        cacheControl: IMMUTABLE_CACHE,
      });
    } catch (error) {
      this.logger.error(`Hujjat saqlanmadi: ${(error as Error).message}`);
      throw ApiError.serviceUnavailable('SERVICE_UNAVAILABLE', 'Faylni saqlab bo‘lmadi');
    }
    return key;
  }

  /** Fayllarni o'chiradi. Xato bo'lsa faqat logga yozadi (asosiy amal to'xtamasligi uchun). */
  async remove(keys: Array<string | null | undefined>): Promise<void> {
    const own = keys.filter((key): key is string => Boolean(key) && !ABSOLUTE_URL.test(key!));
    if (own.length === 0) return;
    try {
      await this.driver.delete(own);
    } catch (error) {
      this.logger.warn(`Fayllar o‘chirilmadi (${own.length}): ${(error as Error).message}`);
    }
  }
}
