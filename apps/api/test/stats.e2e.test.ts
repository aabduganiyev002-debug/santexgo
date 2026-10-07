import { randomUUID } from 'node:crypto';
import type { AdminSalesStats, AdminStatsOverview } from '@santexgo/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeTestApp,
  createAdminAgent,
  createTestApp,
  createUserAgent,
  type TestContext,
  uniqueSuffix,
} from './helpers.js';

type Agent = Awaited<ReturnType<typeof createUserAgent>>;

let ctx: TestContext;
let admin: Agent;
let buyer: Agent;
const suffix = uniqueSuffix();
const ids = { brand: '', category: '', product: '' };
let before: AdminStatsOverview;

async function order(quantity: number): Promise<string> {
  const res = await buyer
    .post('/api/v1/orders')
    .send({
      items: [{ productId: ids.product, quantity }],
      firstName: 'Statistika',
      lastName: 'Mijoz',
      phone: buyer.phone,
      deliveryMethod: 'PICKUP',
      paymentMethod: 'CASH',
      idempotencyKey: randomUUID(),
    })
    .expect(201);
  return res.body.number as string;
}

beforeAll(async () => {
  ctx = await createTestApp();
  admin = await createAdminAgent(ctx);
  buyer = await createUserAgent(ctx, 'CUSTOMER');
  ids.brand = (
    await admin
      .post('/api/v1/admin/brands')
      .send({ name: `Stat brend ${suffix}` })
      .expect(201)
  ).body.id;
  ids.category = (
    await admin
      .post('/api/v1/admin/categories')
      .send({ name: `Stat kat ${suffix}` })
      .expect(201)
  ).body.id;
  ids.product = (
    await admin
      .post('/api/v1/admin/products')
      .send({
        sku: `S-${suffix}`,
        name: `Stat mahsulot ${suffix}`,
        brandId: ids.brand,
        categoryId: ids.category,
        basePrice: 10_000,
        initialStock: 1000,
      })
      .expect(201)
  ).body.id;
  before = (await admin.get('/api/v1/admin/stats/overview').expect(200)).body;
  await order(3);
  const delivered = await order(2);
  await admin
    .patch(`/api/v1/admin/orders/${delivered}/status`)
    .send({ status: 'DELIVERED' })
    .expect(200);
  const cancelled = await order(5);
  await buyer.post(`/api/v1/orders/${cancelled}/cancel`).send({}).expect(200);
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

describe('Admin statistikasi', () => {
  it('bugungi savdo: bekor qilingan buyurtma hisobga olinmaydi', async () => {
    const after = (await admin.get('/api/v1/admin/stats/overview').expect(200))
      .body as AdminStatsOverview;
    expect(after.today.orders - before.today.orders).toBe(2);
    expect(after.today.revenue - before.today.revenue).toBe(50_000);
    expect(after.today.itemsSold - before.today.itemsSold).toBe(5);
    expect(after.month.revenue - before.month.revenue).toBe(50_000);
    expect(after.customers.total).toBeGreaterThanOrEqual(1);
    expect(after.products.active).toBe(after.products.inStock + after.products.outOfStock);
  });

  it('savdo dinamikasi: kunlar to‘liq, oxirgisi — bugun; top mahsulot va brend', async () => {
    const res = await admin.get('/api/v1/admin/stats/sales?range=7d').expect(200);
    const stats = res.body as AdminSalesStats;
    expect(stats.bucket).toBe('day');
    expect(stats.series).toHaveLength(7);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(
      new Date(),
    );
    expect(stats.series.at(-1)!.period).toBe(today);
    expect(stats.totals.revenue).toBe(stats.series.reduce((sum, p) => sum + p.revenue, 0));
    expect(stats.statuses.CANCELLED).toBeGreaterThanOrEqual(1);

    const product = stats.topProducts.find((p) => p.productId === ids.product);
    // Faqat bu testdagi mahsulot: 3 + 2 dona (bekor qilingan 5 dona hisoblanmaydi)
    expect(product).toMatchObject({ quantity: 5, revenue: 50_000 });
    expect(stats.topBrands.map((b) => b.brandId)).toContain(ids.brand);

    const year = (await admin.get('/api/v1/admin/stats/sales?range=12m').expect(200))
      .body as AdminSalesStats;
    expect(year.bucket).toBe('month');
    expect(year.series).toHaveLength(12);
    expect(year.series.at(-1)!.period).toBe(today.slice(0, 7));
  });

  it('noto‘g‘ri davr va mijoz uchun yopiq', async () => {
    await admin.get('/api/v1/admin/stats/sales?range=1y').expect(400);
    await buyer.get('/api/v1/admin/stats/overview').expect(403);
  });
});
