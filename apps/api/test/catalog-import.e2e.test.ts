import {
  type AdminProductDetail,
  type CatalogImportBatchResult,
  SAMPLE_DISCOUNT_NAMES,
  SAMPLE_PRODUCT_SKUS,
} from '@santexgo/shared';
import sharp from 'sharp';
import supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeTestApp,
  createAdminAgent,
  createTestApp,
  createUserAgent,
  type TestContext,
  uniqueSuffix,
} from './helpers.js';

let ctx: TestContext;
let admin: ReturnType<typeof supertest.agent>;
const suffix = uniqueSuffix();
const sku = (name: string) => `E2E-IMP-${suffix}-${name}`.toUpperCase();
const rootSlug = `e2e-imp-${suffix}`;
const childSlug = `e2e-imp-${suffix}-ichki`;
const brandSlug = `e2e-imp-brand-${suffix}`;
const materialAlias = `e2e-imp-mat-${suffix}`;
const diameterKey = `e2e_imp_d_${suffix}`;
const groupName = `E2E ТРУБА ${suffix}`;
const ids = { material: '', diameter: '' };

function importProducts(body: Record<string, unknown>, status = 200) {
  return admin.post('/api/v1/admin/catalog-import/products').send(body).expect(status);
}

function findProduct(code: string) {
  return ctx.prisma.product.findUniqueOrThrow({
    where: { sku: sku(code) },
    include: {
      category: { include: { parent: true } },
      brand: true,
      group: true,
      attributeValues: { include: { attribute: true } },
    },
  });
}

beforeAll(async () => {
  ctx = await createTestApp();
  admin = await createAdminAgent(ctx);
  ids.material = (
    await admin
      .post('/api/v1/admin/materials')
      .send({ name: `E2EIMP${suffix}` })
      .expect(201)
  ).body.id;
  ids.diameter = (
    await admin
      .post('/api/v1/admin/attributes')
      .send({ key: diameterKey, name: 'Diametr', unit: 'mm', type: 'NUMBER' })
      .expect(201)
  ).body.id;
});

afterAll(async () => {
  const products = await ctx.prisma.product.findMany({
    where: { sku: { startsWith: `E2E-IMP-${suffix}` } },
    select: { id: true },
  });
  await ctx.prisma.product.deleteMany({ where: { id: { in: products.map((p) => p.id) } } });
  await ctx.prisma.productGroup.deleteMany({ where: { name: groupName } });
  await ctx.prisma.category.deleteMany({ where: { slug: childSlug } });
  await ctx.prisma.category.deleteMany({ where: { slug: rootSlug } });
  await ctx.prisma.brand.deleteMany({ where: { slug: brandSlug } });
  await ctx.prisma.material.deleteMany({ where: { id: ids.material } });
  await ctx.prisma.attribute.deleteMany({ where: { id: ids.diameter } });
  await closeTestApp(ctx);
});

describe('Admin: katalog importi', () => {
  it('faqat admin uchun', async () => {
    const customer = await createUserAgent(ctx, 'CUSTOMER');
    await customer.post('/api/v1/admin/catalog-import/products').send({ products: [] }).expect(403);
    await ctx.http.post('/api/v1/admin/catalog-import/products').send({ products: [] }).expect(401);
  });

  it('kategoriya, brend va mahsulotlar yaratiladi; xato qator boshqalariga xalaqit bermaydi', async () => {
    const res = await importProducts({
      categories: [
        { slug: rootSlug, name: `E2E Import ${suffix}`, parent: null, attributes: [diameterKey] },
        { slug: childSlug, name: `E2E Ichki ${suffix}`, parent: rootSlug },
      ],
      brands: [{ slug: brandSlug, name: `E2E Import Brand ${suffix}`, country: 'O‘zbekiston' }],
      // Shu nomli material bor (boshqa slug bilan) — yangisi yaratilmaydi
      materials: [{ slug: materialAlias, name: `E2EIMP${suffix}` }],
      products: [
        {
          sku: sku('20'),
          name: 'ТРУБА ППР Ø 20',
          category: childSlug,
          brand: brandSlug,
          material: materialAlias,
          group: groupName,
          groupAttribute: diameterKey,
          unit: 'METER',
          price: 8540,
          stock: 100,
          shortDescription: 'Упаковка: 100 м',
          attributes: { [diameterKey]: 20, [`e2e_yoq_${suffix}`]: 'x' },
        },
        {
          sku: sku('25'),
          name: 'ТРУБА ППР Ø 25',
          category: childSlug,
          brand: brandSlug,
          group: groupName,
          groupAttribute: diameterKey,
          unit: 'METER',
          price: 12_200,
          stock: 100,
          attributes: { [diameterKey]: 25 },
        },
        {
          sku: sku('xato'),
          name: 'Kategoriyasi yo‘q',
          category: `yoq-${suffix}`,
          brand: brandSlug,
          price: 1000,
        },
      ],
    });
    const result = res.body as CatalogImportBatchResult;
    expect(result).toMatchObject({ created: 2, updated: 0, failed: 1 });
    expect(result.warnings).toContain(
      `Noma’lum xususiyat e’tiborsiz qoldirildi: e2e_yoq_${suffix}`,
    );
    expect(result.products.find((p) => p.status === 'failed')).toMatchObject({
      sku: sku('xato'),
      id: null,
      error: `Kategoriya topilmadi: yoq-${suffix}`,
    });

    const pipe = await findProduct('20');
    expect(pipe).toMatchObject({
      name: 'ТРУБА ППР Ø 20',
      unit: 'METER',
      basePrice: 8540,
      currentPrice: 8540,
      availableStock: 100,
      shortDescription: 'Упаковка: 100 м',
      materialId: ids.material,
    });
    expect(pipe.category.slug).toBe(childSlug);
    expect(pipe.category.parent?.slug).toBe(rootSlug);
    expect(pipe.brand).toMatchObject({ slug: brandSlug, country: 'O‘zbekiston' });
    expect(pipe.group).toMatchObject({ name: groupName, variantAttributeKey: diameterKey });
    expect(pipe.attributeValues.map((v) => [v.attribute.key, v.numberValue])).toEqual([
      [diameterKey, 20],
    ]);
    expect((await findProduct('25')).groupId).toBe(pipe.groupId);
    expect(
      await ctx.prisma.categoryAttribute.count({
        where: { category: { slug: rootSlug }, attributeId: ids.diameter },
      }),
    ).toBe(1);
  });

  it('qayta import: nom va narx yangilanadi, qoldiq, kategoriya va tavsif o‘zgarmaydi', async () => {
    const res = await importProducts({
      products: [
        {
          sku: sku('20'),
          name: 'ТРУБА ППР Ø 20 (yangi)',
          category: rootSlug,
          brand: brandSlug,
          price: 9000,
          stock: 5,
        },
      ],
    });
    expect(res.body).toMatchObject({ created: 0, updated: 1, failed: 0 });
    const pipe = await findProduct('20');
    expect(pipe).toMatchObject({
      name: 'ТРУБА ППР Ø 20 (yangi)',
      basePrice: 9000,
      currentPrice: 9000,
      availableStock: 100,
      shortDescription: 'Упаковка: 100 м',
    });
    expect(pipe.category.slug).toBe(childSlug);
  });

  it('bitta rasm bir nechta mahsulotga; umumiy fayl oxirgi mahsulotdan o‘chirilganda o‘chadi', async () => {
    const image = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#e53935' },
    })
      .png()
      .toBuffer();
    const attach = () =>
      admin
        .post('/api/v1/admin/catalog-import/image')
        .field('skus', `${sku('20')}, ${sku('25')}`)
        .attach('file', image, 'truba.png')
        .expect(200);

    expect((await attach()).body).toEqual({ attached: 2, skipped: 0 });
    // Rasmi bor mahsulotlarga qayta biriktirilmaydi — qayta import rasmlarni ko'paytirmaydi
    expect((await attach()).body).toEqual({ attached: 0, skipped: 2 });

    const [first, second] = await Promise.all(
      ['20', '25'].map(async (code) => {
        const { id } = await findProduct(code);
        const detail = (await admin.get(`/api/v1/admin/products/${id}`).expect(200))
          .body as AdminProductDetail;
        expect(detail.images).toHaveLength(1);
        expect(detail.images[0]).toMatchObject({ isMain: true, alt: expect.any(String) });
        return { id, image: detail.images[0]! };
      }),
    );
    expect(first!.image.thumb).toBe(second!.image.thumb);
    await ctx.http.get(first!.image.thumb).expect(200);

    await admin.delete(`/api/v1/admin/products/${first!.id}/images/${first!.image.id}`).expect(200);
    await ctx.http.get(second!.image.thumb).expect(200);
    await admin
      .delete(`/api/v1/admin/products/${second!.id}/images/${second!.image.id}`)
      .expect(200);
    await ctx.http.get(second!.image.thumb).expect(404);
  });

  it('noto‘g‘ri so‘rovlar rad etiladi', async () => {
    const tooMany = Array.from({ length: 101 }, (_, index) => ({
      sku: sku(`K${index}`),
      name: 'Ortiqcha',
      category: rootSlug,
      brand: brandSlug,
      price: 1,
    }));
    await importProducts({ products: tooMany }, 400);
    const badSku = await importProducts(
      { products: [{ sku: 'ТРУБА 1', name: 'x', category: rootSlug, brand: brandSlug, price: 1 }] },
      400,
    );
    expect(badSku.body.code).toBe('VALIDATION_ERROR');
    await importProducts(
      { products: [{ sku: sku('0'), name: 'x', category: rootSlug, brand: brandSlug, price: 0 }] },
      400,
    );
    const noFile = await admin
      .post('/api/v1/admin/catalog-import/image')
      .field('skus', sku('20'))
      .expect(400);
    expect(noFile.body.code).toBe('FILE_INVALID');
  });
});

describe('Admin: namunaviy ma’lumotlar', () => {
  it('namunaviy chegirma o‘chib haqiqiy mahsulot narxi tiklanadi, namunaviy mahsulotlar ketadi', async () => {
    const category = await ctx.prisma.category.findUniqueOrThrow({ where: { slug: childSlug } });
    const brand = await ctx.prisma.brand.findUniqueOrThrow({ where: { slug: brandSlug } });
    // Namunaviy chegirma (seed nomi bilan) haqiqiy (import qilingan) mahsulotga ham tushadi
    await admin
      .post('/api/v1/admin/discounts')
      .send({
        name: SAMPLE_DISCOUNT_NAMES[2],
        type: 'PERCENT',
        value: 5,
        endsAt: new Date(Date.now() + 86_400_000).toISOString(),
        targets: { categoryIds: [category.id] },
      })
      .expect(201);
    expect((await findProduct('25')).currentPrice).toBe(11_590);
    // Seed bo'lmagan bazada — namunaviy mahsulot qo'lda
    const sampleSku = SAMPLE_PRODUCT_SKUS[0]!;
    if (!(await ctx.prisma.product.findUnique({ where: { sku: sampleSku } }))) {
      await admin
        .post('/api/v1/admin/products')
        .send({
          sku: sampleSku,
          name: 'Namunaviy truba',
          brandId: brand.id,
          categoryId: category.id,
          basePrice: 1000,
        })
        .expect(201);
    }

    const summary = (await admin.get('/api/v1/admin/catalog-import/sample-data').expect(200)).body;
    expect(summary.products).toBeGreaterThanOrEqual(1);
    expect(summary.discounts).toBeGreaterThanOrEqual(1);
    const removed = (await admin.delete('/api/v1/admin/catalog-import/sample-data').expect(200))
      .body;
    expect(removed.discounts).toBe(summary.discounts);
    expect(removed.productsDeleted + removed.productsArchived).toBeGreaterThanOrEqual(1);

    expect((await admin.get('/api/v1/admin/catalog-import/sample-data').expect(200)).body).toEqual({
      products: 0,
      discounts: 0,
    });
    expect((await findProduct('25')).currentPrice).toBe(12_200);
    const sample = await ctx.prisma.product.findUnique({ where: { sku: sampleSku } });
    expect(sample === null || !sample.isActive).toBe(true);
  });
});
