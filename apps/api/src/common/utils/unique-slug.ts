import { HttpStatus } from '@nestjs/common';
import { slugify } from '@santexgo/shared';
import { ApiError } from '../errors/api-error.js';

/**
 * Band bo'lmagan slug: "ppr-truba", band bo'lsa "ppr-truba-2", "ppr-truba-3"...
 * `isTaken` — shu slug boshqa yozuvda ishlatilganmi (joriy yozuv hisobga olinmaydi).
 */
export async function uniqueSlug(
  source: string,
  isTaken: (slug: string) => Promise<boolean>,
  maxLength = 200,
): Promise<string> {
  const base = slugify(source, maxLength - 4) || 'item';
  if (!(await isTaken(base))) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Admin aniq slug bergan bo'lsa — u band bo'lmasligi shart (aks holda 409 SLUG_TAKEN);
 * bermagan bo'lsa — nomdan avtomatik, band bo'lsa raqam qo'shiladi.
 */
export async function resolveSlug(options: {
  explicit: string | undefined;
  source: string;
  isTaken: (slug: string) => Promise<boolean>;
  maxLength?: number;
}): Promise<string> {
  if (options.explicit) {
    if (await options.isTaken(options.explicit)) {
      throw ApiError.field(HttpStatus.CONFLICT, 'SLUG_TAKEN', 'slug', 'Bu manzil (slug) band');
    }
    return options.explicit;
  }
  return uniqueSlug(options.source, options.isTaken, options.maxLength);
}
