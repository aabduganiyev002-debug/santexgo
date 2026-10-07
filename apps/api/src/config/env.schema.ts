import { z } from 'zod';

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** .env dagi bo'sh qiymat ("KEY=") berilmagan deb hisoblanadi. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

/** API ishga tushishidan oldin barcha muhit o'zgaruvchilari shu sxema bo'yicha tekshiriladi. */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    APP_TIMEZONE: z
      .string()
      .default('Asia/Tashkent')
      .refine(isValidTimeZone, { message: "Noma'lum vaqt zonasi" }),
    /**
     * Qaysi proksi-serverlarga ishonish (mijozning haqiqiy IP manzilini aniqlash uchun).
     * Standart: lokal va ichki tarmoq (Docker, Caddy, Next.js server).
     */
    TRUST_PROXY: z.string().min(1).default('loopback, linklocal, uniquelocal'),

    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/.+/, {
      message: 'postgresql:// bilan boshlanadigan manzil bo‘lishi kerak',
    }),
    /** Bitta API nusxasi uchun bazaga ulanishlar soni */
    DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),

    /** Rate limit va kesh uchun. Berilmasa, xotirada saqlanadi (faqat bitta API nusxasi uchun) */
    REDIS_URL: optional(
      z.string().regex(/^rediss?:\/\/.+/, { message: 'redis:// bilan boshlanishi kerak' }),
    ),

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

    // ── Auth ──
    /** Tokenlar va SMS kodlarni imzolash uchun maxfiy kalit (kamida 32 belgi, tasodifiy) */
    AUTH_SECRET: z.string().min(32, { message: 'kamida 32 belgidan iborat tasodifiy satr' }),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(180).default(30),
    /** Cookie faqat HTTPS orqali yuborilsin. Berilmasa: production'da true */
    COOKIE_SECURE: optional(z.stringbool()),
    /** Masalan ".santexgo.uz" — bo'sh bo'lsa, cookie faqat joriy domenga tegishli */
    COOKIE_DOMAIN: optional(z.string().regex(/^\.?[a-z0-9.-]+$/i)),

    // ── SMS ──
    /** console — kod terminalga chiqadi (faqat lokal); eskiz — Eskiz.uz orqali haqiqiy SMS */
    SMS_PROVIDER: z.enum(['console', 'eskiz']).default('console'),
    SMS_SENDER: z.string().min(1).max(20).default('4546'),
    ESKIZ_EMAIL: optional(z.email()),
    ESKIZ_PASSWORD: optional(z.string().min(1)),
    /** Bir kunda yuboriladigan SMS'lar soni chegarasi (SMS balansini himoya qilish uchun) */
    SMS_DAILY_LIMIT: z.coerce.number().int().min(1).default(2000),
  })
  .superRefine((env, ctx) => {
    if (env.SMS_PROVIDER === 'eskiz' && (!env.ESKIZ_EMAIL || !env.ESKIZ_PASSWORD)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ESKIZ_EMAIL'],
        message: 'SMS_PROVIDER=eskiz uchun ESKIZ_EMAIL va ESKIZ_PASSWORD berilishi shart',
      });
    }
    if (env.NODE_ENV === 'production' && env.SMS_PROVIDER === 'console') {
      ctx.addIssue({
        code: 'custom',
        path: ['SMS_PROVIDER'],
        message: 'production muhitida haqiqiy SMS provayder kerak (SMS_PROVIDER=eskiz)',
      });
    }
  })
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
  }));

export type Env = z.output<typeof envSchema>;

/** ConfigModule uchun: xato bo'lsa, qaysi o'zgaruvchi noto'g'riligini aniq aytib, ishga tushishni to'xtatadi. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Muhit o'zgaruvchilari noto'g'ri:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
