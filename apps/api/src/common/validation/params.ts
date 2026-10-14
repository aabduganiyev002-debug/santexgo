import { ParseUUIDPipe } from '@nestjs/common';
import { ApiError } from '../errors/api-error.js';

/** URL'dagi ID: UUID bo'lmasa — 404 (mavjud bo'lmagan yozuv kabi). */
export const UuidParam = new ParseUUIDPipe({
  exceptionFactory: () => ApiError.notFound('Topilmadi'),
});
