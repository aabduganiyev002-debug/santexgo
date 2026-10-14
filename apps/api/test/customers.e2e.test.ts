import { randomUUID } from 'node:crypto';
import type { AdminCustomerDetail, AdminCustomerListItem, Paginated } from '@santexgo/shared';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeTestApp,
  createAdminAgent,
  createTestApp,
  createUserAgent,
  type TestContext,
  uniqueSuffix,
  VALID_PASSWORD,
} from './helpers.js';

type Agent = Awaited<ReturnType<typeof createUserAgent>>;

let ctx: TestContext;
let admin: Agent;
let buyer: Agent;
let idle: Agent;
const suffix = uniqueSuffix();
const ids = { brand: '', category: '', product: '' };

beforeAll(async () => {
  ctx = await createTestApp();
  admin = await createAdminAgent(ctx);
  buyer = await createUserAgent(ctx, 'CUSTOMER');
  idle = await createUserAgent(ctx, 'CUSTOMER');
  await ctx.prisma.user.update({
    where: { id: buyer.userId },
    data: {
      firstName: 'Bahodir',
      lastName: `Mijozov${suffix.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]!)}`,
    },
  });
  ids.brand = (
    await admin
      .post('/api/v1/admin/brands')
      .send({ name: `Mijoz brend ${suffix}` })
      .expect(201)
  ).body.id;
  ids.category = (
    await admin
      .post('/api/v1/admin/categories')
      .send({ name: `Mijoz kat ${suffix}` })
      .expect(201)
  ).body.id;
  ids.product = (
    await admin
      .post('/api/v1/admin/products')
      .send({
        sku: `M-${suffix}`,
        name: `Mijoz mahsulot ${suffix}`,
        brandId: ids.brand,
        categoryId: ids.category,
        basePrice: 25_000,
        initialStock: 100,
      })
      .expect(201)
  ).body.id;

  for (const [quantity, status] of [
    [4, 'DELIVERED'],
    [2, 'DELIVERED'],
    [1, 'CANCELLED'],
    [1, null],
  ] as const) {
    const res = await buyer
      .post('/api/v1/orders')
      .send({
        items: [{ productId: ids.product, quantity }],
        firstName: 'Bahodir',
        lastName: 'Mijozov',
        phone: buyer.phone,
        deliveryMethod: 'PICKUP',
        paymentMethod: 'CASH',
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    if (status) {
      await admin
        .patch(`/api/v1/admin/orders/${res.body.number}/status`)
        .send({ status })
        .expect(200);
    }
  }
});

afterAll(async () => {
  const orders = await ctx.prisma.order.findMany({
    where: { userId: buyer.userId },
    select: { id: true },
  });
  await ctx.prisma.payment.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
  await ctx.prisma.order.deleteMany({ where: { userId: buyer.userId } });
  await ctx.prisma.product.deleteMany({ where: { id: ids.product } });
  await ctx.prisma.category.deleteMany({ where: { id: ids.category } });
  await ctx.prisma.brand.deleteMany({ where: { id: ids.brand } });
  await closeTestApp(ctx);
});

describe('Admin: mijozlar bazasi', () => {
  it('telefon bo‘yicha qidiruv: buyurtmalar soni va umumiy xarid summasi', async () => {
    const res = await admin.get(`/api/v1/admin/customers?q=${buyer.phone.slice(-7)}`).expect(200);
    const list = res.body as Paginated<AdminCustomerListItem>;
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({
      id: buyer.userId,
      firstName: 'Bahodir',
      ordersCount: 4,
      totalSpent: 150_000,
      isActive: true,
    });
    expect(list.items[0]!.lastOrderAt).not.toBeNull();
  });

  it('ism bo‘yicha qidiruv va saralash; adminlar ro‘yxatda yo‘q', async () => {
    const byName = await admin.get('/api/v1/admin/customers?q=bahodir').expect(200);
    expect(byName.body.items.map((c: { id: string }) => c.id)).toContain(buyer.userId);

    const bySpent = await admin.get('/api/v1/admin/customers?sort=spent&pageSize=100').expect(200);
    const spent = bySpent.body.items.map((c: AdminCustomerListItem) => c.totalSpent);
    expect(spent).toEqual([...spent].sort((a, b) => b - a));
    const all = await admin.get(`/api/v1/admin/customers?q=${admin.phone.slice(-7)}`).expect(200);
    expect(all.body.total).toBe(0);
    await admin.get(`/api/v1/admin/customers/${admin.userId}`).expect(404);
  });

  it('mijoz kartochkasi: statistika va oxirgi buyurtmalar', async () => {
    const res = await admin.get(`/api/v1/admin/customers/${buyer.userId}`).expect(200);
    const detail = res.body as AdminCustomerDetail;
    expect(detail).toMatchObject({
      ordersCount: 4,
      deliveredCount: 2,
      cancelledCount: 1,
      activeOrdersCount: 1,
      totalSpent: 150_000,
      averageOrder: 75_000,
    });
    expect(detail.recentOrders).toHaveLength(4);

    const empty = await admin.get(`/api/v1/admin/customers/${idle.userId}`).expect(200);
    expect(empty.body).toMatchObject({ ordersCount: 0, totalSpent: 0, lastOrderAt: null });
  });

  it('bloklangan mijoz kira olmaydi va sessiyalari yopiladi', async () => {
    await admin
      .patch(`/api/v1/admin/customers/${idle.userId}`)
      .send({ isActive: false })
      .expect(200);
    await idle.post('/api/v1/auth/refresh').expect(401);
    const login = await ctx.http
      .post('/api/v1/auth/login')
      .send({ phone: idle.phone, password: VALID_PASSWORD })
      .expect(403);
    expect(login.body.code).toBe('ACCOUNT_DISABLED');
    const blocked = await admin
      .get('/api/v1/admin/customers?status=blocked&pageSize=100')
      .expect(200);
    expect(blocked.body.items.map((c: { id: string }) => c.id)).toContain(idle.userId);

    await admin
      .patch(`/api/v1/admin/customers/${idle.userId}`)
      .send({ isActive: true })
      .expect(200);
    await supertest(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ phone: idle.phone, password: VALID_PASSWORD })
      .expect(200);
  });

  it('mijoz uchun yopiq', async () => {
    await buyer.get('/api/v1/admin/customers').expect(403);
  });
});
