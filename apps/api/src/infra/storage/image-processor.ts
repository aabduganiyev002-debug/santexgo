import sharp from 'sharp';

export interface ProcessedImage {
  large: Buffer;
  medium: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

/** Katta, o'rta (kartochka) va kichik (ro'yxat, savatcha) o'lchamlar — kenglik/balandlik chegarasi */
export const IMAGE_SIZES = { large: 1600, medium: 800, thumb: 400 } as const;

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'heif']);
const MAX_INPUT_PIXELS = 50_000_000;

export class InvalidImageError extends Error {}

/**
 * Yuklangan rasmni tekshiradi va WebP'ga o'giradi (3 o'lchamda). Fayl qayta kodlanadi —
 * ichidagi zararli ma'lumot yoki EXIF (GPS va h.k.) saqlanmaydi.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  let metadata: { format?: string };
  try {
    metadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new InvalidImageError('Fayl rasm emas yoki buzilgan');
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    throw new InvalidImageError('Rasm formati qo‘llab-quvvatlanmaydi (JPG, PNG, WebP, AVIF)');
  }

  const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate();
  const render = (size: number, quality: number) =>
    base
      .clone()
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });

  try {
    const [large, medium, thumb] = await Promise.all([
      render(IMAGE_SIZES.large, 82),
      render(IMAGE_SIZES.medium, 80),
      render(IMAGE_SIZES.thumb, 78),
    ]);
    return {
      large: large.data,
      medium: medium.data,
      thumb: thumb.data,
      width: large.info.width,
      height: large.info.height,
    };
  } catch {
    throw new InvalidImageError('Rasmni qayta ishlab bo‘lmadi');
  }
}

/** Bitta o'lchamdagi WebP (logotip, banner). Shaffof fon saqlanadi. */
export async function processSingleImage(input: Buffer, maxSize: number): Promise<Buffer> {
  let format: string | undefined;
  try {
    ({ format } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata());
  } catch {
    throw new InvalidImageError('Fayl rasm emas yoki buzilgan');
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new InvalidImageError('Rasm formati qo‘llab-quvvatlanmaydi (JPG, PNG, WebP, AVIF)');
  }
  try {
    return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
      .rotate()
      .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();
  } catch {
    throw new InvalidImageError('Rasmni qayta ishlab bo‘lmadi');
  }
}

/** PDF fayl ekanini birinchi baytlar bo'yicha tekshiradi (fayl nomi yoki Content-Type'ga ishonilmaydi). */
export function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}
