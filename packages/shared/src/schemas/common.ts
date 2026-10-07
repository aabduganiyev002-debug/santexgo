import { normalizeUzPhone } from '../phone.js';
import { z } from './zod.js';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 60;
export const OTP_CODE_LENGTH = 6;

/** Har xil yozilgan raqamni qabul qiladi va +998901234567 ko'rinishiga keltiradi. */
export const phoneSchema = z
  .string({ error: 'Telefon raqamini kiriting' })
  .trim()
  .min(1, { error: 'Telefon raqamini kiriting' })
  .max(32, { error: 'Telefon raqami noto‘g‘ri' })
  .transform((value, ctx) => {
    const phone = normalizeUzPhone(value);
    if (phone === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Telefon raqami noto‘g‘ri. Masalan: +998 90 123 45 67',
      });
      return z.NEVER;
    }
    return phone;
  });

/** Yangi parol: kamida 8 belgi, kamida bitta harf va bitta raqam. */
export const newPasswordSchema = z
  .string({ error: 'Parolni kiriting' })
  .min(PASSWORD_MIN_LENGTH, {
    error: `Parol kamida ${PASSWORD_MIN_LENGTH} belgidan iborat bo‘lishi kerak`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    error: `Parol ${PASSWORD_MAX_LENGTH} belgidan oshmasligi kerak`,
  })
  .refine((value) => /\p{L}/u.test(value) && /\d/.test(value), {
    error: 'Parolda kamida bitta harf va bitta raqam bo‘lishi kerak',
  });

/** Kirishdagi parol: murakkablik tekshirilmaydi (eski parollar ham ishlashi uchun). */
export const currentPasswordSchema = z
  .string({ error: 'Parolni kiriting' })
  .min(1, { error: 'Parolni kiriting' })
  .max(PASSWORD_MAX_LENGTH, { error: 'Parol juda uzun' });

/** Ism va familiya: harflar, probel, tire va apostrof (O‘tkir, Abdul-Aziz). */
export function personNameSchema(label: 'Ism' | 'Familiya') {
  return z
    .string({ error: `${label}ni kiriting` })
    .trim()
    .min(2, { error: `${label} kamida 2 harfdan iborat bo‘lishi kerak` })
    .max(NAME_MAX_LENGTH, { error: `${label} ${NAME_MAX_LENGTH} belgidan oshmasligi kerak` })
    .regex(/^\p{L}[\p{L}\s'‘’ʻʼ`-]*$/u, {
      error: `${label}da faqat harflar bo‘lishi kerak`,
    })
    .transform((value) => value.replace(/\s+/g, ' '));
}

export const otpCodeSchema = z
  .string({ error: 'SMS kodni kiriting' })
  .trim()
  .regex(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), {
    error: `SMS kod ${OTP_CODE_LENGTH} ta raqamdan iborat`,
  });

/** Parol va uni tasdiqlash bir xilligini tekshiradi (xato "passwordConfirm" maydoniga chiqadi). */
export function passwordsMatch(data: { password: string; passwordConfirm: string }): boolean {
  return data.password === data.passwordConfirm;
}

export const PASSWORDS_MISMATCH: { error: string; path: PropertyKey[] } = {
  error: 'Parollar mos kelmadi',
  path: ['passwordConfirm'],
};

/** Bo'sh satrni undefined ga aylantiradi (ixtiyoriy matn maydonlari uchun). */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));
}

export const uuidSchema = z.uuid({ error: 'Noto‘g‘ri identifikator' });
