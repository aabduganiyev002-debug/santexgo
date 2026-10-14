import type { AdminProductDetail, ProductDetail, ProductListResponse } from '@santexgo/shared';
import sharp from 'sharp';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../src/common/security/password.js';
import {
  closeTestApp,
  createAdminAgent,
  createTestApp,
  randomPhone,
  type TestContext,
  uniqueSuffix,
  VALID_PASSWORD,
} from './helpers.js';

let ctx: TestContext;
let admin: ReturnType<typeof supertest.agent>;
const suffix = uniqueSuffix();

/** Testning o'z katalogi: brend, kategoriya (ichki kategoriyasi bilan), material, xususiyatlar. */
const ids = {
  brand: '',
  otherBrand: '',
  category: '',
  childCategory: '',
  material: '',
  diameter: '',
  pressure: '',
  products: [] as string[],
};
const brandSlug = `e2e-brand-${suffix}`;
const diameterKey = `e2e_d_${suffix}`;
const pressureKey = `e2e_pn_${suffix}`;

async function createProduct(body: Record<string, unknown>): Promise<AdminProductDetail> {
  const res = await admin.post('/api/v1/admin/products').send(body).expect(201);
  ids.products.push(res.body.id);
  return res.body as AdminProductDetail;
}

function listProducts(query: Record<string, string>) {
  return ctx.http
    .get('/api/v1/catalog/products')
    .query({ brand: brandSlug, ...query })
    .expect(200)
    .then((res) => res.body as ProductListResponse);
}

beforeAll(async () => {
  ctx = await createTestApp();
  admin = await createAdminAgent(ctx);

  ids.brand = (
    await admin
      .post('/api/v1/admin/brands')
      .send({ name: `E2E Brand ${suffix}` })
      .expect(201)
  ).body.id;
  ids.otherBrand = (
    await admin
      .post('/api/v1/admin/brands')
      .send({ name: `E2E Other ${suffix}` })
      .expect(201)
  ).body.id;
  ids.diameter = (
    await admin
      .post('/api/v1/admin/attributes')
      .send({ key: diameterKey, name: 'Diametr', unit: 'mm', type: 'NUMBER' })
      .expect(201)
  ).body.id;
  ids.pressure = (
    await admin
      .post('/api/v1/admin/attributes')
      .send({ key: pressureKey, name: 'PN', type: 'TEXT' })
      .expect(201)
  ).body.id;
  ids.category = (
    await admin
      .post('/api/v1/admin/categories')
      .send({ name: `E2E Trubalar ${suffix}`, attributeIds: [ids.diameter, ids.pressure] })
      .expect(201)
  ).body.id;
  ids.childCategory = (
    await admin
      .post('/api/v1/admin/categories')
      .send({ name: `E2E Ichki ${suffix}`, parentId: ids.category })
      .expect(201)
  ).body.id;
  ids.material = (
    await admin
      .post('/api/v1/admin/materials')
      .send({ name: `E2E${suffix}` })
      .expect(201)
  ).body.id;

  const base = { brandId: ids.brand, categoryId: ids.category, materialId: ids.material };
  await createProduct({
    ...base,
    sku: `E2E-${suffix}-20`,
    name: `E2E truba Ø20 ${suffix}`,
    basePrice: 30_000,
    initialStock: 100,
    attributes: [
      { key: diameterKey, value: 20 },
      { key: pressureKey, value: 'PN20' },
    ],
  });
  await createProduct({
    ...base,
    sku: `E2E-${suffix}-25`,
    name: `E2E truba Ø25 ${suffix}`,
    basePrice: 50_000,
    initialStock: 0,
    attributes: [
      { key: diameterKey, value: 25 },
      { key: pressureKey, value: 'PN20' },
    ],
  });
  await createProduct({
    ...base,
    categoryId: ids.childCategory,
    sku: `E2E-${suffix}-32`,
    name: `E2E truba Ø32 ${suffix}`,
    basePrice: 80_000,
    initialStock: 5,
    attributes: [
      { key: diameterKey, value: 32 },
      { key: pressureKey, value: 'PN25' },
    ],
  });
  await createProduct({
    brandId: ids.otherBrand,
    categoryId: ids.category,
    sku: `E2E-${suffix}-OTHER`,
    name: `E2E boshqa ${suffix}`,
    basePrice: 10_000,
    initialStock: 10,
  });
});

afterAll(async () => {
  await ctx.prisma.product.deleteMany({ where: { id: { in: ids.products } } });
  await ctx.prisma.category.deleteMany({ where: { id: { in: [ids.childCategory] } } });
  await ctx.prisma.category.deleteMany({ where: { id: { in: [ids.category] } } });
  await ctx.prisma.brand.deleteMany({ where: { id: { in: [ids.brand, ids.otherBrand] } } });
  await ctx.prisma.material.deleteMany({ where: { id: ids.material } });
  await ctx.prisma.attribute.deleteMany({ where: { id: { in: [ids.diameter, ids.pressure] } } });
  await closeTestApp(ctx);
});

describe('Katalog: filtrlar', () => {
  it('brend bo‘yicha — faqat shu brend, sotuvdagilar birinchi', async () => {
    const result = await listProducts({ sort: 'price_asc' });
    expect(result.total).toBe(3);
    expect(result.items.map((p) => p.sku)).toEqual([
      `E2E-${suffix}-20`,
      `E2E-${suffix}-32`,
      // Sotuvda yo'q — oxirida
      `E2E-${suffix}-25`,
    ]);
    const outOfStock = result.items[2]!;
    expect(outOfStock.stock).toEqual({ available: 0, inStock: false, low: false });
    expect(result.items[1]!.stock).toEqual({ available: 5, inStock: true, low: true });
  });

  it('brend + material + diametr + PN + narx birgalikda', async () => {
    const result = await listProducts({
      material: `e2e${suffix}`,
      [diameterKey]: '20,25',
      [pressureKey]: 'pn20',
      priceMin: '40000',
      priceMax: '60000',
    });
    expect(result.items.map((p) => p.sku)).toEqual([`E2E-${suffix}-25`]);
  });

  it('facet sonlari: tanlangan filtr o‘z guruhidagi boshqa qiymatlarni yashirmaydi', async () => {
    const result = await listProducts({ [diameterKey]: '20' });
    const diameter = result.facets.attributes.find((a) => a.key === diameterKey)!;
    expect(diameter.values).toEqual([
      { value: '20', label: '20', count: 1, selected: true },
      { value: '25', label: '25', count: 1, selected: false },
      { value: '32', label: '32', count: 1, selected: false },
    ]);
    const pressure = result.facets.attributes.find((a) => a.key === pressureKey)!;
    expect(pressure.values).toEqual([{ value: 'PN20', label: 'PN20', count: 1, selected: false }]);
    expect(result.facets.brands.find((b) => b.value === brandSlug)).toMatchObject({
      count: 1,
      selected: true,
    });
    expect(result.facets.price).toEqual({ min: 30_000, max: 30_000 });
  });

  it('kategoriya filtri ichki kategoriyalarni ham qamraydi', async () => {
    const category = await ctx.prisma.category.findUniqueOrThrow({ where: { id: ids.category } });
    const result = await listProducts({ category: category.slug });
    expect(result.total).toBe(3);
    expect(result.category?.breadcrumbs).toEqual([{ slug: category.slug, name: category.name }]);
    expect(result.facets.categories).toHaveLength(1);
    expect(result.facets.categories[0]!.count).toBe(1);
  });

  it('sotuvda borlari filtri', async () => {
    const result = await listProducts({ inStock: '1' });
    expect(result.total).toBe(2);
    expect(result.facets.inStockCount).toBe(2);
  });

  it('qidiruv: SKU, nom va xususiyat qiymati bo‘yicha', async () => {
    const bySku = await ctx.http
      .get('/api/v1/catalog/products')
      .query({ q: `e2e-${suffix}-32` })
      .expect(200);
    expect(bySku.body.items.map((p: { sku: string }) => p.sku)).toEqual([`E2E-${suffix}-32`]);

    const byWords = await ctx.http
      .get('/api/v1/catalog/products')
      .query({ q: `E2E Brand ${suffix} 25 pn20` })
      .expect(200);
    expect(byWords.body.items.map((p: { sku: string }) => p.sku)).toEqual([`E2E-${suffix}-25`]);
  });

  it('noma’lum kategoriya — 404', async () => {
    await ctx.http.get('/api/v1/catalog/products').query({ category: 'mavjud-emas-x' }).expect(404);
  });
});

describe('Katalog: mahsulot sahifasi', () => {
  it('to‘liq ma’lumot: brend, kategoriya yo‘li, xususiyatlar, narx', async () => {
    const product = await ctx.prisma.product.findUniqueOrThrow({
      where: { sku: `E2E-${suffix}-32` },
    });
    const res = await ctx.http.get(`/api/v1/catalog/products/${product.slug}`).expect(200);
    const detail = res.body as ProductDetail;
    expect(detail.brand.slug).toBe(brandSlug);
    expect(detail.breadcrumbs).toHaveLength(2);
    expect(detail.attributes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: diameterKey, value: '32', unit: 'mm' }),
        expect.objectContaining({ key: pressureKey, value: 'PN25' }),
      ]),
    );
    expect(detail.price).toEqual({
      base: 80_000,
      current: 80_000,
      discountPercent: 0,
      discountEndsAt: null,
    });
  });

  it('arxivlangan mahsulot saytda ko‘rinmaydi', async () => {
    const product = await ctx.prisma.product.findUniqueOrThrow({
      where: { sku: `E2E-${suffix}-OTHER` },
    });
    await admin.patch(`/api/v1/admin/products/${product.id}`).send({ isActive: false }).expect(200);
    await ctx.http.get(`/api/v1/catalog/products/${product.slug}`).expect(404);
    await admin.post(`/api/v1/admin/products/${product.id}/restore`).expect(200);
    await ctx.http.get(`/api/v1/catalog/products/${product.slug}`).expect(200);
  });
});

describe('Admin: mahsulotlar', () => {
  it('mijoz va mehmon admin API’ga kira olmaydi', async () => {
    await ctx.http.get('/api/v1/admin/products').expect(401);
    const phone = randomPhone(ctx);
    await ctx.prisma.user.create({
      data: {
        firstName: 'Mijoz',
        lastName: 'Test',
        phone,
        passwordHash: await hashPassword(VALID_PASSWORD),
      },
    });
    const customer = supertest.agent(ctx.app.getHttpServer());
    await customer.post('/api/v1/auth/login').send({ phone, password: VALID_PASSWORD }).expect(200);
    const res = await customer.get('/api/v1/admin/products').expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('qisman tahrirlash boshqa maydonlarni o‘zgartirmaydi', async () => {
    const product = await ctx.prisma.product.findUniqueOrThrow({
      where: { sku: `E2E-${suffix}-20` },
    });
    await admin
      .patch(`/api/v1/admin/products/${product.id}`)
      .send({ isFeatured: true, description: 'Tavsif' })
      .expect(200);
    const res = await admin
      .patch(`/api/v1/admin/products/${product.id}`)
      .send({ basePrice: 32_000 })
      .expect(200);
    const detail = res.body as AdminProductDetail;
    expect(detail).toMatchObject({
      basePrice: 32_000,
      currentPrice: 32_000,
      materialId: ids.material,
      isFeatured: true,
      isActive: true,
      description: 'Tavsif',
    });
    expect(detail.attributes).toHaveLength(2);
  });

  it('SKU band bo‘lsa — 409 va maydon xatosi', async () => {
    const res = await admin
      .post('/api/v1/admin/products')
      .send({
        sku: `e2e-${suffix}-20`,
        name: 'Dublikat',
        brandId: ids.brand,
        categoryId: ids.category,
        basePrice: 1,
      })
      .expect(409);
    expect(res.body).toMatchObject({ code: 'SKU_TAKEN', errors: [{ field: 'sku' }] });
  });

  it('noto‘g‘ri bog‘lanishlar maydonlar bo‘yicha qaytadi', async () => {
    const res = await admin
      .post('/api/v1/admin/products')
      .send({
        sku: `E2E-${suffix}-BAD`,
        name: 'Xato',
        brandId: '01a11522-32e2-712b-985b-000000000000',
        categoryId: ids.category,
        basePrice: 1,
      })
      .expect(400);
    expect(res.body).toMatchObject({ code: 'INVALID_REFERENCE', errors: [{ field: 'brandId' }] });
  });

  it('rasm yuklash: WebP 3 o‘lchamda, birinchisi asosiy; rasm bo‘lmagan fayl rad etiladi', async () => {
    const product = await ctx.prisma.product.findUniqueOrThrow({
      where: { sku: `E2E-${suffix}-25` },
    });
    const image = await sharp({
      create: { width: 2000, height: 1500, channels: 3, background: '#1e88e5' },
    })
      .jpeg()
      .toBuffer();
    const res = await admin
      .post(`/api/v1/admin/products/${product.id}/images`)
      .attach('files', image, 'truba.jpg')
      .attach('files', image, 'truba-2.jpg')
      .expect(201);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ isMain: true, width: 1600, height: 1200 });

    const file = await ctx.http.get(res.body[0].thumb).expect(200);
    expect(file.headers['content-type']).toBe('image/webp');
    expect((await sharp(file.body as Buffer).metadata()).width).toBe(400);

    const bad = await admin
      .post(`/api/v1/admin/products/${product.id}/images`)
      .attach('files', Buffer.from('<svg onload="alert(1)"/>'), 'x.jpg')
      .expect(400);
    expect(bad.body.code).toBe('FILE_INVALID');

    const card = await listProducts({ q: `E2E-${suffix}-25` });
    expect(card.items[0]!.image?.thumb).toBe(res.body[0].thumb);
  });

  it('ombor: kirim → sotuvda; qoldiqdan ko‘p chiqim rad etiladi; tarix yoziladi', async () => {
    const product = await ctx.prisma.product.findUniqueOrThrow({
      where: { sku: `E2E-${suffix}-25` },
    });
    const added = await admin
      .post(`/api/v1/admin/products/${product.id}/inventory`)
      .send({ operation: 'add', quantity: 450, note: 'Partiya' })
      .expect(200);
    expect(added.body[0]).toMatchObject({ quantity: 450, available: 450 });

    const tooMuch = await admin
      .post(`/api/v1/admin/products/${product.id}/inventory`)
      .send({ operation: 'remove', quantity: 451 })
      .expect(400);
    expect(tooMuch.body.code).toBe('STOCK_INSUFFICIENT');

    await admin
      .post(`/api/v1/admin/products/${product.id}/inventory`)
      .send({ operation: 'set', quantity: 440 })
      .expect(200);
    const updated = await ctx.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.availableStock).toBe(440);

    const movements = await admin
      .get(`/api/v1/admin/products/${product.id}/inventory/movements`)
      .expect(200);
    expect(
      movements.body.items.map((m: { type: string; quantityChange: number }) => [
        m.type,
        m.quantityChange,
      ]),
    ).toEqual([
      ['ADJUSTMENT', -10],
      ['RESTOCK', 450],
    ]);
  });

  it('bog‘liq ma’lumotlari bor brend va kategoriya o‘chirilmaydi', async () => {
    const brand = await admin.delete(`/api/v1/admin/brands/${ids.brand}`).expect(409);
    expect(brand.body.code).toBe('HAS_DEPENDENCIES');
    const category = await admin.delete(`/api/v1/admin/categories/${ids.category}`).expect(409);
    expect(category.body.code).toBe('HAS_DEPENDENCIES');
  });

  it('kategoriyani o‘zining ichiga joylab bo‘lmaydi', async () => {
    const res = await admin
      .patch(`/api/v1/admin/categories/${ids.category}`)
      .send({ parentId: ids.childCategory })
      .expect(400);
    expect(res.body.errors).toEqual([{ field: 'parentId', message: expect.any(String) }]);
  });

  it('buyurtmasiz mahsulot butunlay o‘chiriladi va audit jurnaliga yoziladi', async () => {
    const created = await createProduct({
      brandId: ids.brand,
      categoryId: ids.category,
      sku: `E2E-${suffix}-DEL`,
      name: `O‘chiriladigan ${suffix}`,
      basePrice: 1_000,
    });
    const res = await admin.delete(`/api/v1/admin/products/${created.id}`).expect(200);
    expect(res.body).toEqual({ result: 'deleted' });
    expect(await ctx.prisma.product.count({ where: { id: created.id } })).toBe(0);
    const log = await ctx.prisma.auditLog.findFirst({
      where: { entityId: created.id, action: 'product.delete' },
    });
    expect(log).not.toBeNull();
  });
});
