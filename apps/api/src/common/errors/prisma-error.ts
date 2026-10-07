import { HttpStatus } from '@nestjs/common';
import type { ApiErrorCode } from '@santexgo/shared';

interface MappedPrismaError {
  status: HttpStatus;
  code: ApiErrorCode;
  message: string;
}

function prismaCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code, name } = error as { code?: unknown; name?: unknown };
  if (name !== 'PrismaClientKnownRequestError' || typeof code !== 'string') return undefined;
  return code;
}

/**
 * Prisma'ning tanish xatolarini HTTP javobga aylantiradi (ichki tafsilotlar oshkor qilinmaydi).
 * Masalan: unique cheklov buzilsa — 409, yozuv topilmasa — 404.
 */
export function mapPrismaError(error: unknown): MappedPrismaError | null {
  switch (prismaCode(error)) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        code: 'CONFLICT',
        message: 'Bunday qiymatli yozuv allaqachon mavjud',
      };
    case 'P2003':
      return {
        status: HttpStatus.CONFLICT,
        code: 'CONFLICT',
        message: 'Bu yozuv boshqa ma’lumotlar bilan bog‘langan',
      };
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, code: 'NOT_FOUND', message: 'Yozuv topilmadi' };
    default:
      return null;
  }
}

/** P2002 xatosida qaysi ustun(lar) takrorlanganini qaytaradi. */
export function uniqueViolationTarget(error: unknown): string[] {
  if (prismaCode(error) !== 'P2002') return [];
  const meta = (error as { meta?: { target?: unknown; driverAdapterError?: unknown } }).meta;
  const target = meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === 'string') return [target];
  const fields = (
    meta?.driverAdapterError as { cause?: { constraint?: { fields?: unknown } } } | undefined
  )?.cause?.constraint?.fields;
  return Array.isArray(fields) ? fields.map((f) => String(f).replace(/"/g, '')) : [];
}
