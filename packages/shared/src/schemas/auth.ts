import {
  PASSWORDS_MISMATCH,
  currentPasswordSchema,
  newPasswordSchema,
  otpCodeSchema,
  passwordsMatch,
  personNameSchema,
  phoneSchema,
} from './common.js';
import { z } from './zod.js';

export const sendCodeSchema = z.object({ phone: phoneSchema });
export type SendCodeInput = z.input<typeof sendCodeSchema>;

/** Ro'yxatdan o'tish formasining 1-qadami (SMS kod yuborishdan oldin tekshiriladi). */
export const registerDetailsSchema = z
  .object({
    firstName: personNameSchema('Ism'),
    lastName: personNameSchema('Familiya'),
    phone: phoneSchema,
    password: newPasswordSchema,
    passwordConfirm: z.string({ error: 'Parolni qayta kiriting' }),
  })
  .refine(passwordsMatch, PASSWORDS_MISMATCH);
export type RegisterDetailsInput = z.input<typeof registerDetailsSchema>;

export const registerSchema = z
  .object({
    firstName: personNameSchema('Ism'),
    lastName: personNameSchema('Familiya'),
    phone: phoneSchema,
    password: newPasswordSchema,
    passwordConfirm: z.string({ error: 'Parolni qayta kiriting' }),
    code: otpCodeSchema,
  })
  .refine(passwordsMatch, PASSWORDS_MISMATCH);
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;

export const loginSchema = z.object({
  phone: phoneSchema,
  password: currentPasswordSchema,
});
export type LoginInput = z.input<typeof loginSchema>;
export type LoginData = z.output<typeof loginSchema>;

export const passwordResetSchema = z
  .object({
    phone: phoneSchema,
    code: otpCodeSchema,
    password: newPasswordSchema,
    passwordConfirm: z.string({ error: 'Parolni qayta kiriting' }),
  })
  .refine(passwordsMatch, PASSWORDS_MISMATCH);
export type PasswordResetInput = z.input<typeof passwordResetSchema>;
export type PasswordResetData = z.output<typeof passwordResetSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    password: newPasswordSchema,
    passwordConfirm: z.string({ error: 'Parolni qayta kiriting' }),
  })
  .refine(passwordsMatch, PASSWORDS_MISMATCH)
  .refine((data) => data.currentPassword !== data.password, {
    error: 'Yangi parol eskisidan farq qilishi kerak',
    path: ['password'],
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

/** Mobil ilova / bot uchun: refresh token so'rov tanasida (brauzer cookie ishlatadi). */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20).max(200).optional(),
});

/** Shaxsiy kabinet: ism va familiyani o'zgartirish. */
export const profileUpdateSchema = z.object({
  firstName: personNameSchema('Ism'),
  lastName: personNameSchema('Familiya'),
});
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

/** Telefon raqamini o'zgartirish: yangi raqamga kelgan SMS kod bilan. */
export const changePhoneSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});
export type ChangePhoneInput = z.input<typeof changePhoneSchema>;
