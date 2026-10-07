import type { AdminDiscountDetail, ProductDetail } from '@santexgo/shared';
import type supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PricingSchedulerService } from '../src/modules/pricing/pricing-scheduler.service.js';
import {
  closeTestApp,
  createAdminAgent,
  createTestApp,
  type TestContext,
  uniqueSuffix,
} from './helpers.js';

let ctx: TestContext;
let admin: ReturnType<typeof supertest.agent>;
const suffix = uniqueSuffix();
const ids = {
  brand: '',
  category: '',
  child: '',
  products: [] as string[],
  discounts: [] as string[],
};
const slugs: Record<string, string> = {};

async function price(sku: string): Promise<ProductDetail['price']> {
  const res = await ctx.http.get(`/api/v1/catalog/products/${slugs[sku]}`).expect(200);
  return (res.body as ProductDetail).price;
}

async function createDiscount(body: Record<string, unknown>): Promise<AdminDiscountDetail> {
  const res = await admin.post('/api/v1/admin/discounts').send(body).expect(201);
  ids.discounts.push(res.body.id);
  return res.body as AdminDiscountDetail;
}

beforeAll(async () => {
  ctx = await createTestApp();
  admin = await createAdminAgent(ctx);
  ids.brand = (
    await admin
      .post('/api/v1/admin/brands')
      .send({ name: `Chegirma brend ${suffix}` })
      .expect(201)
  ).body.id;
  ids.category = (
    await admin
      .post('/api/v1/admin/categories')
      .send({ name: `Chegirma kat ${suffix}` })
      .expect(201)
  ).body.id;
  ids.child = (
    await admin
      .post('/api/v1/admin/categories')
      .send({ name: `Chegirma ichki ${suffix}`, parentId: ids.category })
      .expect(201)
  ).body.id;
  for (const [sku, basePrice, categoryId] of [
    [`D-${suffix}-A`, 100_000, ids.category],
    [`D-${suffix}-B`, 50_000, ids.child],
  ] as const) {
    const res = await admin
      .post('/api/v1/admin/products')
      .send({
        sku,
        name: `Chegirma mahsulot ${sku}`,
        brandId: ids.brand,
        categoryId,
        basePrice,
        initialStock: 10,
      })
      .expect(201);
    ids.products.push(res.body.id);
    slugs[sku] = res.body.slug;
  }
});

afterAll(async () => {
  await ctx.prisma.discount.deleteMany({ where: { id: { in: ids.discounts } } });
  await ctx.prisma.product.deleteMany({ where: { id: { in: ids.products } } });
  await ctx.prisma.category.deleteMany({ where: { id: ids.child } });
  await ctx.prisma.category.deleteMany({ where: { id: ids.category } });
  await ctx.prisma.brand.deleteMany({ where: { id: ids.brand } });
  await closeTestApp(ctx);
});

describe('Chegirmalar', () => {
  it('brendga 15% → 100 000 dan 85 000, saytda eski va yangi narx', async () => {
    const discount = await createDiscount({
      name: `Brend −15% ${suffix}`,
      type: 'PERCENT',
      value: 15,
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      targets: { brandIds: [ids.brand] },
    });
    expect(discount).toMatchObject({ status: 'active', appliedCount: 2 });
    expect(await price(`D-${suffix}-A`)).toMatchObject({
      base: 100_000,
      current: 85_000,
      discountPercent: 15,
    });
    expect((await price(`D-${suffix}-A`)).discountEndsAt).toBe(discount.endsAt);
  });

  it('bir nechta chegirmadan eng foydalisi tanlanadi, ustma-ust qo‘shilmaydi', async () => {
    await createDiscount({
      name: `Kategoriya 20 000 ${suffix}`,
      type: 'FIXED',
      value: 20_000,
      targets: { categoryIds: [ids.category] },
    });
    // A: 15% = 15 000 < 20 000 → summali; B (ichki kategoriya): 15% = 7 500 < 20 000 → summali
    expect((await price(`D-${suffix}-A`)).current).toBe(80_000);
    expect((await price(`D-${suffix}-B`)).current).toBe(30_000);
  });

  it('o‘chirilgan chegirma qo‘llanmaydi, qayta yoqilsa qo‘llanadi', async () => {
    const fixed = ids.discounts[1]!;
    await admin.patch(`/api/v1/admin/discounts/${fixed}`).send({ isActive: false }).expect(200);
    expect((await price(`D-${suffix}-A`)).current).toBe(85_000);
    const detail = await admin.get(`/api/v1/admin/discounts/${fixed}`).expect(200);
    expect(detail.body).toMatchObject({ status: 'disabled', appliedCount: 0 });
    await admin.patch(`/api/v1/admin/discounts/${fixed}`).send({ isActive: true }).expect(200);
    expect((await price(`D-${suffix}-A`)).current).toBe(80_000);
  });

  it('rejalashtirilgan chegirma vaqti kelganda avtomatik boshlanadi', async () => {
    const startsAt = new Date(Date.now() + 60 * 60_000);
    const scheduled = await createDiscount({
      name: `Ertangi 50% ${suffix}`,
      type: 'PERCENT',
      value: 50,
      startsAt: startsAt.toISOString(),
      targets: { productIds: [ids.products[0]] },
    });
    expect(scheduled.status).toBe('scheduled');
    expect((await price(`D-${suffix}-A`)).current).toBe(80_000);

    const scheduler = ctx.app.get(PricingSchedulerService);
    expect(await scheduler.tick(new Date(startsAt.getTime() + 1000))).toBe(true);
    expect((await price(`D-${suffix}-A`)).current).toBe(50_000);

    // Hozirgi vaqtga qaytarib, keyingi testlar uchun narxlarni tiklaymiz
    await admin.delete(`/api/v1/admin/discounts/${scheduled.id}`).expect(204);
    ids.discounts.splice(ids.discounts.indexOf(scheduled.id), 1);
    expect((await price(`D-${suffix}-A`)).current).toBe(80_000);
  });

  it('ta’sir qiladigan mahsulotlar ro‘yxati', async () => {
    const brandDiscount = ids.discounts[0]!;
    const res = await admin.get(`/api/v1/admin/discounts/${brandDiscount}/products`).expect(200);
    expect(res.body.total).toBe(2);
    const a = res.body.items.find((p: { sku: string }) => p.sku === `D-${suffix}-A`);
    expect(a).toMatchObject({
      basePrice: 100_000,
      currentPrice: 80_000,
      priceWithThisDiscount: 85_000,
      isApplied: false,
      appliedDiscountName: `Kategoriya 20 000 ${suffix}`,
    });
  });

  it('noto‘g‘ri qiymatlar rad etiladi', async () => {
    const res = await admin
      .post('/api/v1/admin/discounts')
      .send({ name: 'X', type: 'PERCENT', value: 150, targets: {} })
      .expect(400);
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual([
      'targets',
      'value',
    ]);

    // Mavjud foizli chegirmaga faqat qiymat berilsa ham tekshiriladi
    await admin
      .patch(`/api/v1/admin/discounts/${ids.discounts[0]}`)
      .send({ value: 101 })
      .expect(400);

    const missing = await admin
      .post('/api/v1/admin/discounts')
      .send({
        name: 'X',
        type: 'FIXED',
        value: 100,
        targets: { brandIds: ['01a11522-32e2-712b-985b-000000000000'] },
      })
      .expect(400);
    expect(missing.body.code).toBe('INVALID_REFERENCE');
  });

  it('chegirma o‘chirilsa narx asl holiga qaytadi', async () => {
    for (const id of ids.discounts.splice(0)) {
      await admin.delete(`/api/v1/admin/discounts/${id}`).expect(204);
    }
    expect(await price(`D-${suffix}-A`)).toMatchObject({
      base: 100_000,
      current: 100_000,
      discountPercent: 0,
    });
  });
});
