import { AUTH_COOKIES, AUTH_LIMITS } from '@santexgo/shared';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeTestApp,
  cookieValue,
  createTestApp,
  lastCode,
  randomPhone,
  type TestContext,
  VALID_PASSWORD,
} from './helpers.js';

const ORIGIN = 'http://localhost:3000';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await closeTestApp(ctx);
});

/** Ro'yxatdan o'tgan va kirgan mijoz (cookie'lar agent ichida). */
async function registerUser(phone = randomPhone(ctx)) {
  const agent = supertest.agent(ctx.app.getHttpServer());
  await agent
    .post('/api/v1/auth/register/send-code')
    .set('origin', ORIGIN)
    .send({ phone })
    .expect(200);
  const res = await agent
    .post('/api/v1/auth/register')
    .set('origin', ORIGIN)
    .send({
      firstName: 'Test',
      lastName: 'Mijoz',
      phone,
      password: VALID_PASSWORD,
      passwordConfirm: VALID_PASSWORD,
      code: lastCode(ctx, phone),
    })
    .expect(201);
  return { agent, phone, res };
}

describe('Ro‘yxatdan o‘tish', () => {
  it('SMS kod → akkaunt → avtomatik kirish (httpOnly cookie)', async () => {
    const phone = randomPhone(ctx);
    const local = phone.slice(4);
    const send = await ctx.http
      .post('/api/v1/auth/register/send-code')
      .send({ phone: `${local.slice(0, 2)} ${local.slice(2)}` })
      .expect(200);
    expect(send.body).toEqual({
      expiresIn: AUTH_LIMITS.codeTtlSeconds,
      resendIn: AUTH_LIMITS.codeResendSeconds,
    });

    const res = await ctx.http
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Ali',
        lastName: 'Valiyev',
        phone,
        password: VALID_PASSWORD,
        passwordConfirm: VALID_PASSWORD,
        code: lastCode(ctx, phone),
      })
      .expect(201);

    expect(res.body.user).toMatchObject({ firstName: 'Ali', phone, role: 'CUSTOMER' });
    expect(res.body).not.toHaveProperty('accessToken');
    expect(res.body).not.toHaveProperty('refreshToken');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.find((c) => c.startsWith(`${AUTH_COOKIES.access}=`))).toMatch(/HttpOnly/);
    expect(cookies.find((c) => c.startsWith(`${AUTH_COOKIES.refresh}=`))).toMatch(
      /Path=\/api\/v1\/auth; .*HttpOnly; SameSite=Strict/,
    );
    expect(cookieValue(cookies, AUTH_COOKIES.hint)).toBe('1');

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { phone } });
    expect(user.phoneVerifiedAt).not.toBeNull();
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('band raqamga kod yubormaydi', async () => {
    const { phone } = await registerUser();
    const res = await ctx.http.post('/api/v1/auth/register/send-code').send({ phone }).expect(409);
    expect(res.body).toMatchObject({ code: 'PHONE_TAKEN' });
    expect(res.body.errors).toEqual([{ field: 'phone', message: expect.any(String) }]);
  });

  it('kodni 60 soniyadan oldin qayta yubormaydi', async () => {
    const phone = randomPhone(ctx);
    await ctx.http.post('/api/v1/auth/register/send-code').send({ phone }).expect(200);
    const res = await ctx.http.post('/api/v1/auth/register/send-code').send({ phone }).expect(429);
    expect(res.body.code).toBe('CODE_RESEND_TOO_SOON');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('5 ta noto‘g‘ri urinishdan keyin kod yaroqsiz bo‘ladi (to‘g‘ri kod ham)', async () => {
    const phone = randomPhone(ctx);
    await ctx.http.post('/api/v1/auth/register/send-code').send({ phone }).expect(200);
    const code = lastCode(ctx, phone);
    const wrong = code === '000000' ? '111111' : '000000';
    const body = {
      firstName: 'Ali',
      lastName: 'Valiyev',
      phone,
      password: VALID_PASSWORD,
      passwordConfirm: VALID_PASSWORD,
    };
    for (let i = 0; i < AUTH_LIMITS.codeMaxAttempts; i += 1) {
      const res = await ctx.http
        .post('/api/v1/auth/register')
        .send({ ...body, code: wrong })
        .expect(400);
      expect(res.body.code).toBe('CODE_INVALID');
    }
    const res = await ctx.http
      .post('/api/v1/auth/register')
      .send({ ...body, code })
      .expect(400);
    expect(res.body.code).toBe('CODE_ATTEMPTS_EXCEEDED');
  });

  it('validatsiya xatolarini maydonlar bo‘yicha qaytaradi', async () => {
    const res = await ctx.http
      .post('/api/v1/auth/register')
      .send({
        firstName: 'A',
        lastName: 'Valiyev',
        phone: '123',
        password: 'qisqa',
        passwordConfirm: 'qisqa',
        code: '12',
      })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    const fields = (res.body.errors as { field: string }[]).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['firstName', 'phone', 'password', 'code']));
  });
});

describe('Kirish va sessiya', () => {
  it('noto‘g‘ri parol → 401, to‘g‘ri parol → kirish, /me ishlaydi', async () => {
    const { phone } = await registerUser();
    const wrong = await ctx.http
      .post('/api/v1/auth/login')
      .send({ phone, password: 'xato-parol1' })
      .expect(401);
    expect(wrong.body.code).toBe('INVALID_CREDENTIALS');

    const agent = supertest.agent(ctx.app.getHttpServer());
    await agent.post('/api/v1/auth/login').send({ phone, password: VALID_PASSWORD }).expect(200);
    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({ phone, role: 'CUSTOMER' });
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('ro‘yxatdan o‘tmagan raqam va noto‘g‘ri parolga bir xil javob', async () => {
    const res = await ctx.http
      .post('/api/v1/auth/login')
      .send({ phone: randomPhone(ctx), password: VALID_PASSWORD })
      .expect(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('10 ta noto‘g‘ri paroldan keyin raqam vaqtincha bloklanadi', async () => {
    const { phone } = await registerUser();
    for (let i = 0; i < 9; i += 1) {
      await ctx.http
        .post('/api/v1/auth/login')
        .send({ phone, password: 'xato-parol1' })
        .expect(401);
    }
    const tenth = await ctx.http
      .post('/api/v1/auth/login')
      .send({ phone, password: 'xato-parol1' })
      .expect(429);
    expect(tenth.body.code).toBe('TOO_MANY_LOGIN_ATTEMPTS');
    const correct = await ctx.http
      .post('/api/v1/auth/login')
      .send({ phone, password: VALID_PASSWORD })
      .expect(429);
    expect(correct.body.code).toBe('TOO_MANY_LOGIN_ATTEMPTS');
  });

  it('refresh token almashtiriladi; eski token muddatdan keyin kelsa sessiya yopiladi', async () => {
    const { res } = await registerUser();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const refresh1 = cookieValue(cookies, AUTH_COOKIES.refresh)!;

    const r2 = await ctx.http
      .post('/api/v1/auth/refresh')
      .set('cookie', `${AUTH_COOKIES.refresh}=${refresh1}`)
      .expect(200);
    const refresh2 = cookieValue(
      r2.headers['set-cookie'] as unknown as string[],
      AUTH_COOKIES.refresh,
    );
    expect(refresh2).toBeTruthy();
    expect(refresh2).not.toBe(refresh1);

    // Parallel tab: eski token qisqa muddat ichida ham ishlaydi, lekin yangi refresh berilmaydi
    const grace = await ctx.http
      .post('/api/v1/auth/refresh')
      .set('cookie', `${AUTH_COOKIES.refresh}=${refresh1}`)
      .expect(200);
    expect(
      cookieValue(grace.headers['set-cookie'] as unknown as string[], AUTH_COOKIES.refresh),
    ).toBeNull();

    // Muddat o'tgandan keyin eski token — o'g'irlangan deb hisoblanadi
    await ctx.prisma.session.updateMany({
      where: { refreshTokenHash: { not: '' }, user: { phone: res.body.user.phone } },
      data: { rotatedAt: new Date(Date.now() - 5 * 60_000) },
    });
    const reuse = await ctx.http
      .post('/api/v1/auth/refresh')
      .set('cookie', `${AUTH_COOKIES.refresh}=${refresh1}`)
      .expect(401);
    expect(reuse.body.code).toBe('SESSION_INVALID');

    // ...va butun sessiya yopilgan: yangi token ham ishlamaydi
    await ctx.http
      .post('/api/v1/auth/refresh')
      .set('cookie', `${AUTH_COOKIES.refresh}=${refresh2}`)
      .expect(401);
  });

  it('chiqishdan keyin refresh ishlamaydi', async () => {
    const { agent } = await registerUser();
    await agent.post('/api/v1/auth/logout').set('origin', ORIGIN).expect(204);
    await agent.post('/api/v1/auth/refresh').set('origin', ORIGIN).expect(401);
  });

  it('bloklangan akkaunt kira olmaydi va sessiyasi yangilanmaydi', async () => {
    const { agent, phone } = await registerUser();
    await ctx.prisma.user.update({ where: { phone }, data: { isActive: false } });
    const login = await ctx.http
      .post('/api/v1/auth/login')
      .send({ phone, password: VALID_PASSWORD })
      .expect(403);
    expect(login.body.code).toBe('ACCOUNT_DISABLED');
    await agent.post('/api/v1/auth/refresh').expect(403);
  });

  it('token rejimi (mobil ilova): tokenlar javobda, Bearer bilan ishlaydi', async () => {
    const { phone } = await registerUser();
    const res = await ctx.http
      .post('/api/v1/auth/login')
      .set('x-auth-mode', 'token')
      .send({ phone, password: VALID_PASSWORD })
      .expect(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();

    await ctx.http
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
    const refreshed = await ctx.http
      .post('/api/v1/auth/refresh')
      .set('x-auth-mode', 'token')
      .send({ refreshToken: res.body.refreshToken })
      .expect(200);
    expect(refreshed.body.refreshToken).not.toBe(res.body.refreshToken);
  });

  it('yaroqsiz token bilan yopiq manzil 401, ochiq manzil ishlaydi', async () => {
    await ctx.http
      .get('/api/v1/auth/me')
      .set('authorization', 'Bearer yaroqsiz.token.qiymat')
      .expect(401);
    await ctx.http.get('/api/health').set('cookie', `${AUTH_COOKIES.access}=yaroqsiz`).expect(200);
  });
});

describe('Parolni tiklash', () => {
  it('ro‘yxatdan o‘tmagan raqamga ham bir xil javob, lekin SMS yuborilmaydi', async () => {
    const phone = randomPhone(ctx);
    const res = await ctx.http
      .post('/api/v1/auth/password-reset/send-code')
      .send({ phone })
      .expect(200);
    expect(res.body).toEqual({
      expiresIn: AUTH_LIMITS.codeTtlSeconds,
      resendIn: AUTH_LIMITS.codeResendSeconds,
    });
    expect(ctx.sms.lastMessageTo(phone)).toBeUndefined();
    // Qayta yuborish chegarasi ham bir xil ishlaydi
    await ctx.http.post('/api/v1/auth/password-reset/send-code').send({ phone }).expect(429);
  });

  it('yangi parol o‘rnatiladi, boshqa qurilmalardagi sessiyalar yopiladi', async () => {
    const { agent: oldDevice, phone } = await registerUser();
    await ctx.http.post('/api/v1/auth/password-reset/send-code').send({ phone }).expect(200);
    const newPassword = 'Yangi-parol-2026';
    const res = await ctx.http
      .post('/api/v1/auth/password-reset')
      .send({
        phone,
        code: lastCode(ctx, phone),
        password: newPassword,
        passwordConfirm: newPassword,
      })
      .expect(200);
    expect(res.body.user.phone).toBe(phone);

    await oldDevice.post('/api/v1/auth/refresh').expect(401);
    await ctx.http.post('/api/v1/auth/login').send({ phone, password: VALID_PASSWORD }).expect(401);
    await ctx.http.post('/api/v1/auth/login').send({ phone, password: newPassword }).expect(200);
  });
});

describe('CSRF himoyasi', () => {
  it('begona saytdan kelgan so‘rovni rad etadi', async () => {
    const res = await ctx.http
      .post('/api/v1/auth/login')
      .set('origin', 'https://evil.example')
      .send({ phone: '+998901234567', password: 'x' })
      .expect(403);
    expect(res.body.code).toBe('CSRF_REJECTED');
    await ctx.http.post('/api/v1/auth/logout').set('origin', 'null').expect(403);
    await ctx.http.post('/api/v1/auth/logout').set('sec-fetch-site', 'cross-site').expect(403);
  });

  it('ruxsat etilgan saytdan va brauzerdan tashqari so‘rovlarni o‘tkazadi', async () => {
    await ctx.http.post('/api/v1/auth/logout').set('origin', ORIGIN).expect(204);
    await ctx.http.post('/api/v1/auth/logout').set('referer', `${ORIGIN}/account`).expect(204);
    await ctx.http.post('/api/v1/auth/logout').expect(204);
  });
});

describe('Xatolar formati', () => {
  it('noma’lum manzil — 404 o‘zbekcha xabar va requestId bilan', async () => {
    const res = await ctx.http.get('/api/v1/mavjud-emas').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(res.body.requestId).toBeTruthy();
  });

  it('buzilgan JSON — 400', async () => {
    const res = await ctx.http
      .post('/api/v1/auth/login')
      .set('content-type', 'application/json')
      .send('{buzilgan')
      .expect(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });
});
