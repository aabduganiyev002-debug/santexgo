import { randomUUID } from 'node:crypto';
import type { AccountOverview, AddressView } from '@santexgo/shared';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeTestApp,
  createAdminAgent,
  createTestApp,
  createUserAgent,
  lastCode,
  randomPhone,
  type TestContext,
  uniqueSuffix,
  VALID_PASSWORD,
} from './helpers.js';

type Agent = Awaited<ReturnType<typeof createUserAgent>>;

let ctx: TestContext;
let admin: Agent;
let customer: Agent;
const suffix = uniqueSuffix();
const ids = { brand: '', category: '', product: '' };

beforeAll(async () => {
  ctx = await createTestApp();
  admin = await createAdminAgent(ctx);
  customer = await createUserAgent(ctx, 'CUSTOMER');
  ids.brand = (
    await admin
      .post('/api/v1/admin/brands')
      .send({ name: `Kabinet brend ${suffix}` })
      .expect(201)
  ).body.id;
  ids.category = (
    await admin
      .post('/api/v1/admin/categories')
      .send({ name: `Kabinet kat ${suffix}` })
      .expect(201)
  ).body.id;
  ids.product = (
    await admin
      .post('/api/v1/admin/products')
      .send({
        sku: `K-${suffix}`,
        name: `Kabinet mahsulot ${suffix}`,
        brandId: ids.brand,
        categoryId: ids.category,
        basePrice: 40_000,
        initialStock: 100,
      })
      .expect(201)
  ).body.id;
});

afterAll(async () => {
  const orders = await ctx.prisma.order.findMany({
    where: { userId: customer.userId },
    select: { id: true },
  });
  await ctx.prisma.payment.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
  await ctx.prisma.order.deleteMany({ where: { userId: customer.userId } });
  // Telefon raqami testda o'zgaradi — foydalanuvchi ID bo'yicha o'chiriladi
  await ctx.prisma.user.deleteMany({ where: { id: customer.userId } });
  await ctx.prisma.product.deleteMany({ where: { id: ids.product } });
  await ctx.prisma.category.deleteMany({ where: { id: ids.category } });
  await ctx.prisma.brand.deleteMany({ where: { id: ids.brand } });
  await closeTestApp(ctx);
});

describe('Kabinet: umumiy ma’lumot', () => {
  it('yangi mijozda nollar, buyurtmadan keyin — hozirgi buyurtma va hisob', async () => {
    const empty = (await customer.get('/api/v1/account/overview').expect(200))
      .body as AccountOverview;
    expect(empty).toMatchObject({
      user: { id: customer.userId, phone: customer.phone },
      stats: { ordersCount: 0, activeOrdersCount: 0, deliveredCount: 0, totalSpent: 0 },
      activeOrders: [],
      favoritesCount: 0,
      addresses: [],
    });

    const order = await customer
      .post('/api/v1/orders')
      .send({
        items: [{ productId: ids.product, quantity: 3 }],
        firstName: 'Kamola',
        lastName: 'Rahimova',
        phone: customer.phone,
        deliveryMethod: 'PICKUP',
        paymentMethod: 'CASH',
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    await customer.put(`/api/v1/favorites/${ids.product}`).expect(204);

    const after = (await customer.get('/api/v1/account/overview').expect(200))
      .body as AccountOverview;
    expect(after.stats).toMatchObject({ ordersCount: 1, activeOrdersCount: 1, totalSpent: 0 });
    expect(after.activeOrders.map((o) => o.number)).toEqual([order.body.number]);
    expect(after.favoritesCount).toBe(1);

    await admin
      .patch(`/api/v1/admin/orders/${order.body.number}/status`)
      .send({ status: 'DELIVERED' })
      .expect(200);
    const delivered = (await customer.get('/api/v1/account/overview').expect(200))
      .body as AccountOverview;
    expect(delivered.stats).toMatchObject({
      ordersCount: 1,
      activeOrdersCount: 0,
      deliveredCount: 1,
      totalSpent: 120_000,
    });
  });

  it('kirmagan foydalanuvchi uchun yopiq', async () => {
    await ctx.http.get('/api/v1/account/overview').expect(401);
  });
});

describe('Kabinet: profil', () => {
  it('ism va familiya o‘zgaradi, noto‘g‘ri qiymat rad etiladi', async () => {
    const res = await customer
      .patch('/api/v1/account/profile')
      .send({ firstName: '  Kamola ', lastName: 'Rahimova' })
      .expect(200);
    expect(res.body).toMatchObject({ firstName: 'Kamola', lastName: 'Rahimova' });
    const me = await customer.get('/api/v1/auth/me').expect(200);
    expect(me.body.firstName).toBe('Kamola');
    await customer
      .patch('/api/v1/account/profile')
      .send({ firstName: 'K1', lastName: '' })
      .expect(400);
  });
});

describe('Kabinet: manzillar', () => {
  it('birinchi manzil asosiy; asosiy o‘chirilsa — keyingisi asosiy bo‘ladi', async () => {
    const first = (
      await customer
        .post('/api/v1/addresses')
        .send({
          label: 'Uy',
          region: 'Toshkent shahri',
          district: 'Chilonzor',
          street: 'Qatortol 5',
        })
        .expect(201)
    ).body as AddressView;
    expect(first.isDefault).toBe(true);
    const second = (
      await customer
        .post('/api/v1/addresses')
        .send({
          label: 'Obyekt',
          region: 'Toshkent viloyati',
          district: 'Zangiota',
          street: 'Yangi hayot 1',
          isDefault: true,
        })
        .expect(201)
    ).body as AddressView;
    let list = (await customer.get('/api/v1/addresses').expect(200)).body as AddressView[];
    expect(list.map((a) => [a.label, a.isDefault])).toEqual([
      ['Obyekt', true],
      ['Uy', false],
    ]);

    await customer
      .put(`/api/v1/addresses/${first.id}`)
      .send({ region: 'Toshkent shahri', district: 'Chilonzor', street: 'Qatortol 7', house: '12' })
      .expect(200);
    await customer.delete(`/api/v1/addresses/${second.id}`).expect(204);
    list = (await customer.get('/api/v1/addresses').expect(200)).body as AddressView[];
    expect(list).toMatchObject([
      { id: first.id, street: 'Qatortol 7', house: '12', label: null, isDefault: true },
    ]);

    // Boshqa mijozning manzili ko'rinmaydi va o'zgartirilmaydi
    const other = await createUserAgent(ctx, 'CUSTOMER');
    await other.delete(`/api/v1/addresses/${first.id}`).expect(404);
    expect((await other.get('/api/v1/addresses').expect(200)).body).toEqual([]);
  });
});

describe('Kabinet: parol', () => {
  it('joriy parol noto‘g‘ri bo‘lsa rad etiladi', async () => {
    const res = await customer
      .post('/api/v1/account/password')
      .send({
        currentPassword: 'NotoGri123',
        password: 'Yangi12345',
        passwordConfirm: 'Yangi12345',
      })
      .expect(400);
    expect(res.body).toMatchObject({
      code: 'PASSWORD_INCORRECT',
      errors: [{ field: 'currentPassword' }],
    });
  });

  it('o‘zgaradi: joriy qurilma ishlaydi, boshqa qurilmalar chiqariladi', async () => {
    const phone = (await customer.get('/api/v1/auth/me').expect(200)).body.phone as string;
    const otherDevice = supertest.agent(ctx.app.getHttpServer());
    await otherDevice
      .post('/api/v1/auth/login')
      .send({ phone, password: VALID_PASSWORD })
      .expect(200);

    await customer
      .post('/api/v1/account/password')
      .send({
        currentPassword: VALID_PASSWORD,
        password: 'Yangi12345',
        passwordConfirm: 'Yangi12345',
      })
      .expect(204);

    await customer.get('/api/v1/auth/me').expect(200);
    await customer.post('/api/v1/auth/refresh').expect(200);
    await otherDevice.post('/api/v1/auth/refresh').expect(401);
    await ctx.http.post('/api/v1/auth/login').send({ phone, password: VALID_PASSWORD }).expect(401);
    await ctx.http.post('/api/v1/auth/login').send({ phone, password: 'Yangi12345' }).expect(200);
  });
});

describe('Kabinet: telefon raqami', () => {
  it('yangi raqamga SMS kod bilan o‘zgaradi', async () => {
    const current = (await customer.get('/api/v1/auth/me').expect(200)).body.phone as string;
    await customer.post('/api/v1/account/phone/send-code').send({ phone: current }).expect(400);
    const taken = await customer
      .post('/api/v1/account/phone/send-code')
      .send({ phone: admin.phone })
      .expect(409);
    expect(taken.body.code).toBe('PHONE_TAKEN');

    const next = randomPhone(ctx);
    await customer.post('/api/v1/account/phone/send-code').send({ phone: next }).expect(200);
    const wrong = await customer
      .post('/api/v1/account/phone')
      .send({ phone: next, code: '000000' === lastCode(ctx, next) ? '111111' : '000000' })
      .expect(400);
    expect(wrong.body.code).toBe('CODE_INVALID');
    const res = await customer
      .post('/api/v1/account/phone')
      .send({ phone: next, code: lastCode(ctx, next) })
      .expect(200);
    expect(res.body.phone).toBe(next);

    await ctx.http
      .post('/api/v1/auth/login')
      .send({ phone: next, password: 'Yangi12345' })
      .expect(200);
    await ctx.http
      .post('/api/v1/auth/login')
      .send({ phone: current, password: 'Yangi12345' })
      .expect(401);
  });
});
