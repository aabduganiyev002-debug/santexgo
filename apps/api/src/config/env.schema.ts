import { z } from 'zod';

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** API ishga tushishidan oldin barcha muhit o'zgaruvchilari shu sxema bo'yicha tekshiriladi. */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  APP_TIMEZONE: z
    .string()
    .default('Asia/Tashkent')
    .refine(isValidTimeZone, { message: "Noma'lum vaqt zonasi" }),

  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/.+/, {
    message: 'postgresql:// bilan boshlanadigan manzil bo‘lishi kerak',
  }),
  /** Bitta API nusxasi uchun bazaga ulanishlar soni */
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),

  /** Vergul bilan ajratilgan frontend manzillari */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url({ protocol: /^https?$/ }))),

  SWAGGER_ENABLED: z.stringbool().default(false),
});

export type Env = z.infer<typeof envSchema>;

/** ConfigModule uchun: xato bo'lsa, qaysi o'zgaruvchi noto'g'riligini aniq aytib, ishga tushishni to'xtatadi. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Muhit o'zgaruvchilari noto'g'ri:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
