import { randomUUID } from 'node:crypto';
import type {
  AdminOrderDetail,
  AdminOrderListResponse,
  AdminProductDetail,
  CartView,
  OrderDetailView,
  ProductDetail,
  SiteSettings,
} from '@santexgo/shared';
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
let customer: Agent;
let other: Agent;
let settings: SiteSettings;
const suffix = uniqueSuffix();
const ids = { brand: '', category: '', users: [] as string[] };
/** Mahsulotlar: pipe — 450 dona, fitting — 3 dona (kamida 2), none — 0, last — 1 */
const products: Record<'pipe' | 'fitting' | 'none' | 'last', { id: string; slug: string }> = {
  pipe: { id: '', slug: '' },
  fitting: { id: '', slug: '' },
  none: { id: '', slug: '' },
  last: { id: '', slug: '' },
};

const ADDRESS = {
  region: 'Toshkent shahri',
  district: 'Chilonzor tumani',
  street: 'Bunyodkor ko‘chasi',
  house: '12',
};

function checkout(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ productId: products.pipe.id, quantity: 10 }],
    firstName: 'Alisher',
    lastName: 'Karimov',
    phone: '+998 90 111 22 33',
    deliveryMethod: 'DELIVERY',
    address: ADDRESS,
    paymentMethod: 'CASH',
    idempotencyKey: randomUUID(),
    ...overrides,
  };
}

async function adminProduct(id: string): Promise<AdminProductDetail> {
  return (await admin.get(`/api/v1/admin/products/${id}`).expect(200)).body as AdminProductDetail;
}

async function available(key: keyof typeof products): Promise<number> {
  const res = await ctx.http.get(`/api/v1/catalog/products/${products[key].slug}`).expect(200);
  return (res.body as ProductDetail).stock.available;
}

function stockOf(product: AdminProductDetail) {
  return {
    quantity: product.stock.reduce((sum, s) => sum + s.quantity, 0),
    reserved: product.stock.reduce((sum, s) => sum + s.reserved, 0),
  };
}

function setStatus(order: string, status: string, note?: string) {
  return admin.patch(`/api/v1/admin/orders/${order}/status`).send({ status, note });
}

beforeAll(async () => {
  ctx = await createTestApp();
  admin = await createAdminAgent(ctx);
  customer = await createUserAgent(ctx, 'CUSTOMER');
  other = await createUserAgent(ctx, 'CUSTOMER');
  ids.users.push(admin.userId, customer.userId, other.userId);
  settings = (await ctx.http.get('/api/v1/site/settings').expect(200)).body;

  ids.brand = (
    await admin
      .post('/api/v1/admin/brands')
      .send({ name: `Buyurtma brend ${suffix}` })
      .expect(201)
  ).body.id;
  ids.category = (
    await admin
      .post('/api/v1/admin/categories')
      .send({ name: `Buyurtma kat ${suffix}` })
      .expect(201)
  ).body.id;
  const specs = {
    pipe: { basePrice: 100_000, initialStock: 450 },
    fitting: { basePrice: 50_000, initialStock: 3, minOrderQty: 2 },
    none: { basePrice: 10_000, initialStock: 0 },
    last: { basePrice: 20_000, initialStock: 1 },
  };
  for (const [key, spec] of Object.entries(specs)) {
    const res = await admin
      .post('/api/v1/admin/products')
      .send({
        sku: `O-${suffix}-${key}`,
        name: `Buyurtma ${key} ${suffix}`,
        brandId: ids.brand,
        categoryId: ids.category,
        ...spec,
      })
      .expect(201);
    products[key as keyof typeof products] = { id: res.body.id, slug: res.body.slug };
  }
});

afterAll(async () => {
  const orders = await ctx.prisma.order.findMany({
    where: { userId: { in: ids.users } },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  await ctx.prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
  await ctx.prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await ctx.prisma.product.deleteMany({
    where: { id: { in: Object.values(products).map((p) => p.id) } },
  });
  await ctx.prisma.category.deleteMany({ where: { id: ids.category } });
  await ctx.prisma.brand.deleteMany({ where: { id: ids.brand } });
  await closeTestApp(ctx);
});

describe('Savatcha', () => {
  it('mehmon savatchasi hisoblanadi: narx, qoldiq muammolari, yetkazib berish', async () => {
    const missing = randomUUID();
    const res = await ctx.http
      .post('/api/v1/cart/preview')
      .send({
        items: [
          { productId: products.pipe.id, quantity: 4 },
          { productId: products.fitting.id, quantity: 5 },
          { productId: products.none.id, quantity: 1 },
          { productId: missing, quantity: 1 },
          { productId: products.pipe.id, quantity: 1 },
        ],
      })
      .expect(200);
    const cart = res.body as CartView;
    expect(cart.unavailableProductIds).toEqual([missing]);
    expect(cart.lines.map((l) => [l.productId, l.quantity, l.issue])).toEqual([
      [products.pipe.id, 5, null],
      [products.fitting.id, 5, 'INSUFFICIENT_STOCK'],
      [products.none.id, 1, 'OUT_OF_STOCK'],
    ]);
    expect(cart.hasIssues).toBe(true);
    // Sotuvda yo'q mahsulot summaga kirmaydi
    const itemsTotal = 5 * 100_000 + 5 * 50_000;
    const fee =
      settings.delivery.freeFrom !== null && itemsTotal >= settings.delivery.freeFrom
        ? 0
        : settings.delivery.baseFee;
    expect(cart.summary).toMatchObject({
      itemsCount: 10,
      linesCount: 2,
      itemsTotal,
      deliveryFee: fee,
      total: itemsTotal + fee,
    });

    const pickup = await ctx.http
      .post('/api/v1/cart/preview')
      .send({ items: [{ productId: products.pipe.id, quantity: 1 }], deliveryMethod: 'PICKUP' })
      .expect(200);
    expect(pickup.body.summary.deliveryFee).toBe(0);
  });

  it('kamida miqdordan kam — muammo; noto‘g‘ri miqdor rad etiladi', async () => {
    const res = await ctx.http
      .post('/api/v1/cart/preview')
      .send({ items: [{ productId: products.fitting.id, quantity: 1 }] })
      .expect(200);
    expect(res.body.lines[0].issue).toBe('BELOW_MIN');
    await ctx.http
      .post('/api/v1/cart/preview')
      .send({ items: [{ productId: products.pipe.id, quantity: 0 }] })
      .expect(400);
  });

  it('kirgan foydalanuvchi savatchasi bazada saqlanadi va brauzerdagisi bilan qo‘shiladi', async () => {
    await ctx.http.get('/api/v1/cart').expect(401);
    await customer.put(`/api/v1/cart/items/${products.pipe.id}`).send({ quantity: 3 }).expect(200);
    await customer.put(`/api/v1/cart/items/${randomUUID()}`).send({ quantity: 1 }).expect(404);

    const merged = await customer
      .post('/api/v1/cart/merge')
      .send({
        items: [
          { productId: products.pipe.id, quantity: 2 },
          { productId: products.fitting.id, quantity: 2 },
        ],
      })
      .expect(200);
    // Ikkalasida bor mahsulotning kattaroq miqdori olinadi
    expect((merged.body as CartView).lines.map((l) => [l.productId, l.quantity])).toEqual([
      [products.pipe.id, 3],
      [products.fitting.id, 2],
    ]);

    const removed = await customer.delete(`/api/v1/cart/items/${products.fitting.id}`).expect(200);
    expect(removed.body.lines).toHaveLength(1);
    expect((await customer.get('/api/v1/cart').expect(200)).body.summary.itemsCount).toBe(3);
  });
});

describe('Sevimlilar', () => {
  it('qo‘shish takrorlansa ham bitta; ro‘yxat va o‘chirish', async () => {
    await customer.put(`/api/v1/favorites/${products.pipe.id}`).expect(204);
    await customer.put(`/api/v1/favorites/${products.pipe.id}`).expect(204);
    await customer.put(`/api/v1/favorites/${randomUUID()}`).expect(404);
    expect((await customer.get('/api/v1/favorites/ids').expect(200)).body.productIds).toEqual([
      products.pipe.id,
    ]);
    const list = await customer.get('/api/v1/favorites').expect(200);
    expect(list.body).toMatchObject({ total: 1, items: [{ id: products.pipe.id }] });
    await customer.delete(`/api/v1/favorites/${products.pipe.id}`).expect(204);
    expect((await customer.get('/api/v1/favorites/ids').expect(200)).body.productIds).toEqual([]);
  });
});

describe('Buyurtma berish', () => {
  let order: OrderDetailView;

  it('noto‘g‘ri ma’lumotlar rad etiladi', async () => {
    await ctx.http.post('/api/v1/orders').send(checkout()).expect(401);

    const noAddress = await customer
      .post('/api/v1/orders')
      .send(checkout({ address: undefined }))
      .expect(400);
    expect(noAddress.body.errors[0].field).toBe('address');

    const online = await customer
      .post('/api/v1/orders')
      .send(checkout({ paymentMethod: 'CLICK' }))
      .expect(400);
    expect(online.body.code).toBe('PAYMENT_METHOD_UNAVAILABLE');

    const empty = await customer
      .post('/api/v1/orders')
      .send(checkout({ items: [] }))
      .expect(400);
    expect(empty.body.code).toBe('VALIDATION_ERROR');
  });

  it('qoldiq yetmasa — 409 CART_CHANGED, hech narsa yozilmaydi', async () => {
    const res = await customer
      .post('/api/v1/orders')
      .send(
        checkout({
          items: [
            { productId: products.pipe.id, quantity: 1 },
            { productId: products.fitting.id, quantity: 5 },
            { productId: products.none.id, quantity: 1 },
          ],
        }),
      )
      .expect(409);
    expect(res.body.code).toBe('CART_CHANGED');
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(
      [`items.${products.fitting.id}`, `items.${products.none.id}`].sort(),
    );
    expect(await available('pipe')).toBe(450);
    expect(await ctx.prisma.order.count({ where: { userId: customer.userId } })).toBe(0);
  });

  it('ekrandagi summa farq qilsa — 409 PRICE_CHANGED', async () => {
    const res = await customer
      .post('/api/v1/orders')
      .send(checkout({ expectedTotal: 1 }))
      .expect(409);
    expect(res.body.code).toBe('PRICE_CHANGED');
  });

  it('buyurtma yaratiladi: ORDER-ID, sotuvdagi qoldiq 450 → 440, savatchadan olinadi', async () => {
    const preview = await ctx.http
      .post('/api/v1/cart/preview')
      .send({ items: [{ productId: products.pipe.id, quantity: 10 }] })
      .expect(200);
    const key = randomUUID();
    const res = await customer
      .post('/api/v1/orders')
      .send(
        checkout({
          idempotencyKey: key,
          expectedTotal: preview.body.summary.total,
          comment: 'Kirish eshigi orqa tomonda',
          saveAddress: true,
        }),
      )
      .expect(201);
    order = res.body as OrderDetailView;
    expect(order.number).toMatch(/^ORDER-\d{5,}$/);
    expect(order).toMatchObject({
      status: 'RECEIVED',
      paymentMethod: 'CASH',
      paymentStatus: 'PENDING',
      subtotal: 1_000_000,
      discountTotal: 0,
      total: preview.body.summary.total,
      itemsCount: 10,
      canCancel: true,
      customer: { firstName: 'Alisher', lastName: 'Karimov', phone: '+998901112233' },
      address: { region: 'Toshkent shahri', house: '12', apartment: null },
      items: [
        { productId: products.pipe.id, quantity: 10, unitPrice: 100_000, lineTotal: 1_000_000 },
      ],
      history: [{ status: 'RECEIVED' }],
    });

    expect(await available('pipe')).toBe(440);
    expect(stockOf(await adminProduct(products.pipe.id))).toEqual({ quantity: 450, reserved: 10 });

    // Savatchada faqat buyurtmaga kirmagan mahsulotlar qoladi
    expect((await customer.get('/api/v1/cart').expect(200)).body.lines).toEqual([]);

    // "Manzilni saqlash" — birinchi manzil asosiy bo'ladi
    const addresses = await customer.get('/api/v1/addresses').expect(200);
    expect(addresses.body).toMatchObject([{ ...ADDRESS, isDefault: true }]);

    // Tugma ikki marta bosilsa — yangi buyurtma yaratilmaydi
    const again = await customer
      .post('/api/v1/orders')
      .send(checkout({ idempotencyKey: key }))
      .expect(200);
    expect(again.body.id).toBe(order.id);
    expect(await available('pipe')).toBe(440);
  });

  it('narx keyin o‘zgarsa ham buyurtmadagi narx o‘zgarmaydi', async () => {
    await admin
      .patch(`/api/v1/admin/products/${products.pipe.id}`)
      .send({ basePrice: 120_000 })
      .expect(200);
    const res = await customer.get(`/api/v1/orders/${order.number}`).expect(200);
    expect(res.body.items[0]).toMatchObject({ unitPrice: 100_000, lineTotal: 1_000_000 });
    await admin
      .patch(`/api/v1/admin/products/${products.pipe.id}`)
      .send({ basePrice: 100_000 })
      .expect(200);
  });

  it('saqlangan manzil va do‘kondan olib ketish', async () => {
    const [address] = (await customer.get('/api/v1/addresses').expect(200)).body;
    await other
      .post('/api/v1/orders')
      .send(checkout({ address: undefined, addressId: address.id }))
      .expect(400);

    const pickup = await customer
      .post('/api/v1/orders')
      .send(
        checkout({
          items: [{ productId: products.fitting.id, quantity: 2 }],
          deliveryMethod: 'PICKUP',
          address: undefined,
        }),
      )
      .expect(201);
    expect(pickup.body).toMatchObject({ deliveryFee: 0, address: null, total: 100_000 });
    expect(await available('fitting')).toBe(1);

    // Mijoz o'zi bekor qiladi — band bo'shaydi
    const cancelled = await customer
      .post(`/api/v1/orders/${pickup.body.number}/cancel`)
      .send({ reason: 'Fikrimdan qaytdim' })
      .expect(200);
    expect(cancelled.body).toMatchObject({
      status: 'CANCELLED',
      canCancel: false,
      paymentStatus: 'CANCELLED',
      cancelReason: 'Mijoz bekor qildi: Fikrimdan qaytdim',
    });
    expect(await available('fitting')).toBe(3);
    await customer.post(`/api/v1/orders/${pickup.body.number}/cancel`).send({}).expect(409);
  });

  it('oxirgi dona uchun bir vaqtdagi ikki buyurtmadan faqat bittasi o‘tadi', async () => {
    const body = (agent: Agent) =>
      agent.post('/api/v1/orders').send(
        checkout({
          items: [{ productId: products.last.id, quantity: 1 }],
          deliveryMethod: 'PICKUP',
          address: undefined,
        }),
      );
    const results = await Promise.all([body(customer), body(other)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await available('last')).toBe(0);
    const winner = results.find((r) => r.status === 201)!;
    await setStatus(winner.body.number, 'CANCELLED', 'Test').expect(200);
    expect(await available('last')).toBe(1);
  });

  it('mijoz faqat o‘z buyurtmalarini ko‘radi', async () => {
    const list = await customer.get('/api/v1/orders').expect(200);
    expect(list.body.total).toBeGreaterThanOrEqual(2);
    expect(list.body.items[0]).toHaveProperty('number');
    const active = await customer.get('/api/v1/orders?status=active').expect(200);
    expect(active.body.items.every((o: { status: string }) => o.status !== 'CANCELLED')).toBe(true);

    await other.get(`/api/v1/orders/${order.number}`).expect(404);
    await other.post(`/api/v1/orders/${order.number}/cancel`).send({}).expect(404);
    await customer.get('/api/v1/orders/ORDER-abc').expect(404);
    await customer.get('/api/v1/admin/orders').expect(403);
  });
});

describe('Admin: buyurtma statuslari va ombor', () => {
  let number: string;

  beforeAll(async () => {
    const res = await customer
      .post('/api/v1/orders')
      .send(checkout({ items: [{ productId: products.pipe.id, quantity: 10 }] }))
      .expect(201);
    number = res.body.number;
  });

  it('ro‘yxat: raqam, telefon va ism bo‘yicha qidiruv, statuslar soni', async () => {
    const byNumber = await admin.get(`/api/v1/admin/orders?q=${number}`).expect(200);
    const body = byNumber.body as AdminOrderListResponse;
    expect(body.items.map((o) => o.number)).toEqual([number]);
    expect(body.items[0]).toMatchObject({ customerName: 'Alisher Karimov', status: 'RECEIVED' });

    const byUser = await admin
      .get(`/api/v1/admin/orders?userId=${customer.userId}&status=active`)
      .expect(200);
    expect(byUser.body.statusCounts.CANCELLED).toBeGreaterThanOrEqual(1);
    expect(byUser.body.items.every((o: { status: string }) => o.status !== 'CANCELLED')).toBe(true);

    const byName = await admin
      .get(
        `/api/v1/admin/orders?q=${encodeURIComponent('alisher karimov')}&userId=${customer.userId}`,
      )
      .expect(200);
    expect(byName.body.total).toBeGreaterThanOrEqual(2);
    const byPhone = await admin
      .get(`/api/v1/admin/orders?q=90111&userId=${customer.userId}`)
      .expect(200);
    expect(byPhone.body.total).toBe(byName.body.total);
  });

  it('tafsilot: mijoz, ruxsat etilgan statuslar, ichki izoh', async () => {
    const res = await admin.get(`/api/v1/admin/orders/${number}`).expect(200);
    const detail = res.body as AdminOrderDetail;
    expect(detail.allowedTransitions).toEqual([
      'CONFIRMING',
      'PREPARING',
      'DELIVERING',
      'DELIVERED',
      'CANCELLED',
    ]);
    expect(detail.user).toMatchObject({ id: customer.userId, totalSpent: 0 });
    expect(detail.history[0]).toMatchObject({ status: 'RECEIVED', changedBy: 'Mijoz' });

    const noted = await admin
      .patch(`/api/v1/admin/orders/${number}`)
      .send({ adminNote: 'Mijoz kechqurun uyda' })
      .expect(200);
    expect(noted.body.adminNote).toBe('Mijoz kechqurun uyda');
    const mine = await customer.get(`/api/v1/orders/${number}`).expect(200);
    expect(mine.body).not.toHaveProperty('adminNote');
  });

  it('Yetkazib berilmoqda → ombordan chiqadi; Yetkazildi → sotildi va to‘landi', async () => {
    const before = await adminProduct(products.pipe.id);
    await setStatus(number, 'CONFIRMING').expect(200);
    const preparing = await setStatus(number, 'PREPARING', 'Ombor yig‘moqda').expect(200);
    expect(preparing.body.confirmedAt).not.toBeNull();

    // Mijoz endi bekor qila olmaydi
    const refused = await customer.post(`/api/v1/orders/${number}/cancel`).send({}).expect(409);
    expect(refused.body.code).toBe('ORDER_NOT_CANCELLABLE');

    await setStatus(number, 'DELIVERING').expect(200);
    const shipped = stockOf(await adminProduct(products.pipe.id));
    expect(shipped).toEqual({
      quantity: stockOf(before).quantity - 10,
      reserved: stockOf(before).reserved - 10,
    });

    const delivered = await setStatus(number, 'DELIVERED').expect(200);
    expect(delivered.body).toMatchObject({
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      allowedTransitions: [],
      user: { totalSpent: delivered.body.total },
    });
    expect(delivered.body.history.map((h: { status: string }) => h.status)).toEqual([
      'RECEIVED',
      'CONFIRMING',
      'PREPARING',
      'DELIVERING',
      'DELIVERED',
    ]);
    expect((await adminProduct(products.pipe.id)).soldCount).toBe(before.soldCount + 10);

    const invalid = await setStatus(number, 'CANCELLED').expect(409);
    expect(invalid.body.code).toBe('ORDER_STATUS_INVALID');

    const customerView = await customer.get(`/api/v1/orders/${number}`).expect(200);
    expect(customerView.body.history.every((h: { note: unknown }) => h.note === null)).toBe(true);
  });

  it('yo‘lga chiqqan buyurtma bekor qilinsa — mahsulot omborga qaytadi', async () => {
    const res = await customer
      .post('/api/v1/orders')
      .send(checkout({ items: [{ productId: products.pipe.id, quantity: 5 }] }))
      .expect(201);
    const before = stockOf(await adminProduct(products.pipe.id));
    // Oraliq bosqichlar o'tkazib yuboriladi: band qilingan 5 dona ombordan chiqadi
    await setStatus(res.body.number, 'DELIVERING').expect(200);
    expect(stockOf(await adminProduct(products.pipe.id))).toEqual({
      quantity: before.quantity - 5,
      reserved: before.reserved - 5,
    });
    await setStatus(res.body.number, 'CANCELLED', 'Mijoz qabul qilmadi').expect(200);
    expect(stockOf(await adminProduct(products.pipe.id))).toEqual({
      quantity: before.quantity,
      reserved: before.reserved - 5,
    });

    const movements = await admin
      .get(`/api/v1/admin/products/${products.pipe.id}/inventory/movements`)
      .expect(200);
    expect(movements.body.items.slice(0, 3).map((m: { type: string }) => m.type)).toEqual([
      'RETURN',
      'ORDER_SHIP',
      'ORDER_RESERVE',
    ]);
  });

  it('to‘lov holati qo‘lda o‘zgartiriladi, noto‘g‘ri holatlar rad etiladi', async () => {
    const res = await customer
      .post('/api/v1/orders')
      .send(
        checkout({
          items: [{ productId: products.pipe.id, quantity: 1 }],
          paymentMethod: 'CARD_ON_DELIVERY',
        }),
      )
      .expect(201);
    const n = res.body.number;
    await admin.patch(`/api/v1/admin/orders/${n}`).send({ paymentStatus: 'REFUNDED' }).expect(409);
    const paid = await admin
      .patch(`/api/v1/admin/orders/${n}`)
      .send({ paymentStatus: 'PAID' })
      .expect(200);
    expect(paid.body.paymentStatus).toBe('PAID');
    await admin.patch(`/api/v1/admin/orders/${n}`).send({}).expect(400);
    await setStatus(n, 'CANCELLED').expect(200);
    // To'langan summa bekor qilinganda ham "to'langan" qoladi — admin qaytarishni belgilaydi
    const refunded = await admin
      .patch(`/api/v1/admin/orders/${n}`)
      .send({ paymentStatus: 'REFUNDED' })
      .expect(200);
    expect(refunded.body.paymentStatus).toBe('REFUNDED');
  });

  it('tasdiqlanmagan buyurtmalar soni cheklangan', async () => {
    const pending = await ctx.prisma.order.count({
      where: { userId: other.userId, status: { in: ['RECEIVED', 'CONFIRMING'] } },
    });
    const order = () =>
      other.post('/api/v1/orders').send(
        checkout({
          items: [{ productId: products.pipe.id, quantity: 1 }],
          deliveryMethod: 'PICKUP',
          address: undefined,
        }),
      );
    for (let i = pending; i < 5; i += 1) await order().expect(201);
    const res = await order().expect(409);
    expect(res.body.code).toBe('ORDER_LIMIT_REACHED');
  });
});
