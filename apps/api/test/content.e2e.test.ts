import type { HomePageData, SiteSettings } from '@santexgo/shared';
import sharp from 'sharp';
import type supertest from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
const created = { banners: [] as string[], collections: [] as string[] };
let originalSettings: SiteSettings;

beforeAll(async () => {
  ctx = await createTestApp();
  admin = await createAdminAgent(ctx);
  originalSettings = (await ctx.http.get('/api/v1/site/settings').expect(200)).body;
});

afterAll(async () => {
  await ctx.prisma.banner.deleteMany({ where: { id: { in: created.banners } } });
  await ctx.prisma.homeCollection.deleteMany({ where: { id: { in: created.collections } } });
  await admin.put('/api/v1/admin/settings/store').send(originalSettings.store);
  await admin.put('/api/v1/admin/settings/delivery').send(originalSettings.delivery);
  await closeTestApp(ctx);
});

describe('Bannerlar', () => {
  it('rasm bilan yaratiladi va bosh sahifada chiqadi; muddati o‘tganlari chiqmaydi', async () => {
    const image = await sharp({
      create: { width: 2400, height: 800, channels: 3, background: '#0d47a1' },
    })
      .jpeg()
      .toBuffer();
    const res = await admin
      .post('/api/v1/admin/banners')
      .field('title', `Kuzgi aksiya ${suffix}`)
      .field('linkUrl', '/catalog?onSale=1')
      .field('isActive', 'true')
      .attach('image', image, 'banner.jpg')
      .expect(201);
    created.banners.push(res.body.id);
    expect(res.body).toMatchObject({ title: `Kuzgi aksiya ${suffix}`, mobileImageUrl: null });
    const file = await ctx.http.get(res.body.imageUrl).expect(200);
    expect((await sharp(file.body as Buffer).metadata()).width).toBe(1920);

    const expired = await admin
      .post('/api/v1/admin/banners')
      .field('title', `Eski ${suffix}`)
      .field('endsAt', new Date(Date.now() - 60_000).toISOString())
      .attach('image', image, 'old.jpg')
      .expect(201);
    created.banners.push(expired.body.id);

    const home = (await ctx.http.get('/api/v1/catalog/home').expect(200)).body as HomePageData;
    const titles = home.banners.map((b) => b.title);
    expect(titles).toContain(`Kuzgi aksiya ${suffix}`);
    expect(titles).not.toContain(`Eski ${suffix}`);
  });

  it('rasmsiz banner va xavfli havola rad etiladi', async () => {
    await admin.post('/api/v1/admin/banners').field('title', 'X').expect(400);
    const image = await sharp({
      create: { width: 100, height: 50, channels: 3, background: '#000' },
    })
      .png()
      .toBuffer();
    const res = await admin
      .post('/api/v1/admin/banners')
      .field('linkUrl', 'javascript:alert(1)')
      .attach('image', image, 'x.png')
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('"Material bo‘yicha" tugmalari', () => {
  it('kamida bitta filtr talab qilinadi, slug avtomatik', async () => {
    await admin.post('/api/v1/admin/home-collections').send({ title: 'Bo‘sh' }).expect(400);
    const material = await ctx.prisma.material.findFirstOrThrow();
    const res = await admin
      .post('/api/v1/admin/home-collections')
      .send({ title: `Test ${suffix}`, materialId: material.id })
      .expect(201);
    created.collections.push(res.body.id);
    expect(res.body).toMatchObject({ slug: `test-${suffix}`, filterLabel: material.name });
  });
});

describe('Sozlamalar', () => {
  it('admin o‘zgartiradi, sayt ko‘radi; telefon normallashtiriladi', async () => {
    await admin
      .put('/api/v1/admin/settings/store')
      .send({ name: 'SantexGo', phone: '90 111 22 33', workingHours: '9:00–18:00' })
      .expect(200);
    await admin
      .put('/api/v1/admin/settings/delivery')
      .send({ baseFee: 25_000, freeFrom: 500_000, pickupEnabled: true })
      .expect(200);
    const res = await ctx.http.get('/api/v1/site/settings').expect(200);
    expect(res.body).toMatchObject({
      store: { name: 'SantexGo', phone: '+998901112233', workingHours: '9:00–18:00' },
      delivery: { baseFee: 25_000, freeFrom: 500_000, pickupEnabled: true },
    });
  });

  it('mijoz sozlamalarni o‘zgartira olmaydi', async () => {
    await ctx.http.put('/api/v1/admin/settings/store').send({ name: 'Hack' }).expect(401);
  });
});
