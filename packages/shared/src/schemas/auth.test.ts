import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  loginSchema,
  passwordResetSchema,
  registerDetailsSchema,
  registerSchema,
} from './auth.js';

const valid = {
  firstName: '  O‘tkir ',
  lastName: 'Abdul-Aziz',
  phone: '90 123 45 67',
  password: 'parol1234',
  passwordConfirm: 'parol1234',
  code: '123456',
};

function fieldErrors(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.'));
}

describe('registerSchema', () => {
  it('to‘g‘ri ma’lumotni qabul qiladi va normallashtiradi', () => {
    const result = registerSchema.parse(valid);
    expect(result).toEqual({
      firstName: 'O‘tkir',
      lastName: 'Abdul-Aziz',
      phone: '+998901234567',
      password: 'parol1234',
      passwordConfirm: 'parol1234',
      code: '123456',
    });
  });

  it('kirill yozuvidagi ismni qabul qiladi', () => {
    expect(registerSchema.safeParse({ ...valid, firstName: 'Шерзод' }).success).toBe(true);
  });

  it('parollar mos kelmasa passwordConfirm maydoniga xato chiqaradi', () => {
    const result = registerSchema.safeParse({ ...valid, passwordConfirm: 'boshqa1234' });
    expect(fieldErrors(result)).toEqual(['passwordConfirm']);
    expect(result.error?.issues[0]?.message).toBe('Parollar mos kelmadi');
  });

  it('kuchsiz parol, noto‘g‘ri telefon, ism va kodni rad etadi', () => {
    expect(fieldErrors(registerSchema.safeParse({ ...valid, password: '12345678' }))).toContain(
      'password',
    );
    expect(fieldErrors(registerSchema.safeParse({ ...valid, password: 'qisqa1' }))).toContain(
      'password',
    );
    expect(fieldErrors(registerSchema.safeParse({ ...valid, phone: '12345' }))).toEqual(['phone']);
    expect(fieldErrors(registerSchema.safeParse({ ...valid, firstName: 'A1' }))).toEqual([
      'firstName',
    ]);
    expect(fieldErrors(registerSchema.safeParse({ ...valid, code: '12a456' }))).toEqual(['code']);
  });

  it('ortiqcha maydonlarni tashlab yuboradi', () => {
    const result = registerSchema.parse({ ...valid, role: 'ADMIN' });
    expect(result).not.toHaveProperty('role');
  });
});

describe('registerDetailsSchema', () => {
  it('kodsiz tekshiradi', () => {
    const { code: _code, ...details } = valid;
    expect(registerDetailsSchema.safeParse(details).success).toBe(true);
  });
});

describe('loginSchema', () => {
  it('eski kuchsiz parolni ham qabul qiladi (faqat bo‘sh emasligi tekshiriladi)', () => {
    expect(loginSchema.parse({ phone: '+998 (90) 123-45-67', password: 'x' })).toEqual({
      phone: '+998901234567',
      password: 'x',
    });
    expect(loginSchema.safeParse({ phone: '+998901234567', password: '' }).success).toBe(false);
  });
});

describe('passwordResetSchema / changePasswordSchema', () => {
  it('parolni tiklash', () => {
    expect(
      passwordResetSchema.safeParse({
        phone: '901234567',
        code: '000000',
        password: 'yangi1234',
        passwordConfirm: 'yangi1234',
      }).success,
    ).toBe(true);
  });

  it('yangi parol eskisi bilan bir xil bo‘lmasligi kerak', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'parol1234',
      password: 'parol1234',
      passwordConfirm: 'parol1234',
    });
    expect(fieldErrors(result)).toEqual(['password']);
  });
});
