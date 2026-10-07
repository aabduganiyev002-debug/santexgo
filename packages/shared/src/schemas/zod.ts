import { z } from 'zod';

/**
 * Barcha sxemalar uchun yagona zod nusxasi: standart xato matnlari o'zbek tilida.
 * Muhim maydonlar uchun sxemalarning o'zida aniqroq matn beriladi.
 */
z.config(z.locales.uz());

export { z };
