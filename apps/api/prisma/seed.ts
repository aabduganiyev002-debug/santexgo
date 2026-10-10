/**
 * Boshlang'ich ma'lumotlar: ombor, materiallar, xususiyatlar, kategoriyalar, brendlar,
 * namunaviy mahsulotlar, chegirmalar, homepage tugmalari, sozlamalar va birinchi admin.
 *
 * Qayta ishga tushirish xavfsiz: dublikat yaratilmaydi, mavjud ombor qoldiqlari, sozlamalar
 * va admin paroli o'zgartirilmaydi. Lokal muhitda ma'lumotnomalar seed'dagi holatga yangilanadi.
 * Production'da (SEED_SAMPLE_PRODUCTS=false) namunaviy brend, mahsulot va chegirmalarsiz; ma'lumotnomalar
 * faqat bo'sh bazaga (birinchi o'rnatishda) yoziladi — admin o'zgartirgan yoki o'chirgan yozuvlar
 * keyingi ishga tushirishlarda qayta paydo bo'lmaydi.
 *
 * Ishga tushirish: pnpm db:seed
 * Faqat admin yaratish/tayinlash: SEED_SCOPE=admin pnpm db:seed
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { isDiscountActive, normalizeUzPhone, slugify } from '@santexgo/shared';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { ADMIN_PASSWORD_MIN_LENGTH, hashPassword } from '../src/common/security/password.js';
import { dbErrorHint } from '../src/infra/prisma/db-error-hint.js';
import { buildSearchText } from '../src/modules/catalog/search-text.js';
import { priceProduct } from '../src/modules/pricing/pricing.calculator.js';
import {
  ATTRIBUTES,
  BRANDS,
  CATEGORIES,
  DISCOUNTS,
  GROUPS,
  HOME_COLLECTIONS,
  MATERIALS,
  PRODUCTS,
  SETTINGS,
  WAREHOUSE,
  type AttributeValue,
} from './seed/catalog.js';

try {
  process.loadEnvFile();
} catch {
  // .env bo'lmasa, o'zgaruvchilar muhitdan olinadi
}

const DAY_MS = 24 * 60 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} muhit o'zgaruvchisi berilmagan`);
  return value;
}

function requireId(map: Map<string, string>, key: string, kind: string): string {
  const id = map.get(key);
  if (!id) throw new Error(`Seed ma'lumotida noma'lum ${kind}: "${key}"`);
  return id;
}

/** Ma'lumotlardagi xatolarni bazaga yozishdan oldin aniqlaydi. */
function validateCatalog(): void {
  const skus = new Set<string>();
  const slugs = new Set<string>();
  const attributeKeys = new Set(ATTRIBUTES.map((a) => a.key));
  for (const p of PRODUCTS) {
    const slug = slugify(p.name);
    if (skus.has(p.sku)) throw new Error(`Takroriy SKU: ${p.sku}`);
    if (slugs.has(slug)) throw new Error(`Takroriy slug: ${slug} (${p.name})`);
    skus.add(p.sku);
    slugs.add(slug);
    if (!Number.isSafeInteger(p.basePrice) || p.basePrice < 0) {
      throw new Error(`Noto'g'ri narx: ${p.sku}`);
    }
    for (const key of Object.keys(p.attributes)) {
      if (!attributeKeys.has(key)) throw new Error(`Noma'lum xususiyat "${key}" (${p.sku})`);
    }
  }
}

function attributeValueData(value: AttributeValue): {
  numberValue: number | null;
  textValue: string | null;
  booleanValue: boolean | null;
} {
  if (typeof value === 'number') return { numberValue: value, textValue: null, booleanValue: null };
  if (typeof value === 'boolean')
    return { numberValue: null, textValue: null, booleanValue: value };
  return { numberValue: null, textValue: value, booleanValue: null };
}

/**
 * withSamples=true (lokal): yozuvlar seed'dagi holatga keltiriladi, namunaviy brendlar va
 * variant guruhlari ham yoziladi. withSamples=false (production): mavjud yozuvlarga tegilmaydi,
 * brendlar va guruhlar (ular namunaviy mahsulotlar uchun) yaratilmaydi.
 */
async function seedReferenceData(prisma: PrismaClient, withSamples: boolean) {
  const overwrite = withSamples;
  const warehouse = await prisma.warehouse.upsert({
    where: { code: WAREHOUSE.code },
    update: {},
    create: { ...WAREHOUSE, isDefault: true },
  });

  const materialIds = new Map<string, string>();
  for (const m of MATERIALS) {
    const row = await prisma.material.upsert({
      where: { slug: m.slug },
      update: overwrite ? { name: m.name, fullName: m.fullName, sortOrder: m.sortOrder } : {},
      create: m,
    });
    materialIds.set(m.slug, row.id);
  }

  const attributeIds = new Map<string, string>();
  for (const a of ATTRIBUTES) {
    const row = await prisma.attribute.upsert({
      where: { key: a.key },
      update: overwrite ? a : {},
      create: a,
    });
    attributeIds.set(a.key, row.id);
  }

  // Ota kategoriyalar avval yaratiladi
  const categoryIds = new Map<string, string>();
  const ordered = [...CATEGORIES].sort(
    (a, b) => Number(Boolean(a.parent)) - Number(Boolean(b.parent)),
  );
  for (const c of ordered) {
    const parentId = c.parent ? requireId(categoryIds, c.parent, 'kategoriya') : null;
    const data = { name: c.name, sortOrder: c.sortOrder, parentId };
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: overwrite ? data : {},
      create: { ...data, slug: c.slug },
    });
    categoryIds.set(c.slug, row.id);

    for (const [index, key] of c.attributes.entries()) {
      const attributeId = requireId(attributeIds, key, 'xususiyat');
      await prisma.categoryAttribute.upsert({
        where: { categoryId_attributeId: { categoryId: row.id, attributeId } },
        update: overwrite ? { sortOrder: index } : {},
        create: { categoryId: row.id, attributeId, sortOrder: index },
      });
    }
  }

  const brandIds = new Map<string, string>();
  for (const b of withSamples ? BRANDS : []) {
    const row = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: overwrite ? b : {},
      create: b,
    });
    brandIds.set(b.slug, row.id);
  }

  const groupIds = new Map<string, string>();
  for (const g of withSamples ? GROUPS : []) {
    const existing = await prisma.productGroup.findFirst({ where: { name: g.name } });
    const row = !existing
      ? await prisma.productGroup.create({ data: g })
      : overwrite
        ? await prisma.productGroup.update({ where: { id: existing.id }, data: g })
        : existing;
    groupIds.set(g.name, row.id);
  }

  return { warehouse, materialIds, attributeIds, categoryIds, brandIds, groupIds };
}

async function seedProducts(
  prisma: PrismaClient,
  refs: Awaited<ReturnType<typeof seedReferenceData>>,
): Promise<{ productIds: Map<string, string>; restocked: number }> {
  const productIds = new Map<string, string>();
  let restocked = 0;

  for (const p of PRODUCTS) {
    const data = {
      name: p.name,
      slug: slugify(p.name),
      brandId: requireId(refs.brandIds, p.brand, 'brend'),
      categoryId: requireId(refs.categoryIds, p.category, 'kategoriya'),
      materialId: p.material ? requireId(refs.materialIds, p.material, 'material') : null,
      groupId: p.group ? requireId(refs.groupIds, p.group, 'mahsulot guruhi') : null,
      unit: p.unit ?? 'PIECE',
      basePrice: p.basePrice,
      shortDescription: p.shortDescription,
      description: p.description,
      isFeatured: p.isFeatured ?? false,
    } satisfies Prisma.ProductUncheckedUpdateInput;

    // currentPrice keyinroq chegirmalar bo'yicha qayta hisoblanadi
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: data,
      create: { ...data, sku: p.sku, currentPrice: p.basePrice },
    });
    productIds.set(p.sku, product.id);

    for (const [key, value] of Object.entries(p.attributes)) {
      const attributeId = requireId(refs.attributeIds, key, 'xususiyat');
      const valueData = attributeValueData(value);
      await prisma.productAttributeValue.upsert({
        where: { productId_attributeId: { productId: product.id, attributeId } },
        update: valueData,
        create: { productId: product.id, attributeId, ...valueData },
      });
    }

    // Qoldiq faqat birinchi marta yoziladi — real ombor ma'lumotlari ustidan yozilmaydi
    const inventoryKey = { productId: product.id, warehouseId: refs.warehouse.id };
    const existing = await prisma.inventory.findUnique({
      where: { productId_warehouseId: inventoryKey },
    });
    if (!existing) {
      await prisma.$transaction([
        prisma.inventory.create({ data: { ...inventoryKey, quantity: p.stock } }),
        prisma.inventoryMovement.create({
          data: {
            ...inventoryKey,
            type: 'RESTOCK',
            quantityChange: p.stock,
            quantityAfter: p.stock,
            reservedAfter: 0,
            note: 'Boshlang‘ich qoldiq (seed)',
          },
        }),
      ]);
      restocked += 1;
    }
  }

  return { productIds, restocked };
}

async function seedDiscounts(
  prisma: PrismaClient,
  refs: Awaited<ReturnType<typeof seedReferenceData>>,
  productIds: Map<string, string>,
): Promise<void> {
  const now = Date.now();
  for (const d of DISCOUNTS) {
    const data = {
      name: d.name,
      type: d.type,
      value: d.value,
      startsAt: new Date(now - DAY_MS),
      endsAt: new Date(now + d.durationDays * DAY_MS),
      isActive: true,
    };
    const existing = await prisma.discount.findFirst({ where: { name: d.name } });
    const discount = existing
      ? await prisma.discount.update({ where: { id: existing.id }, data })
      : await prisma.discount.create({ data });

    const productTargets = [
      ...(d.targets.products ?? []).map((sku) => requireId(productIds, sku, 'SKU')),
      ...(d.targets.groups ?? []).flatMap((groupName) => {
        const groupId = requireId(refs.groupIds, groupName, 'mahsulot guruhi');
        return PRODUCTS.filter((p) => p.group && refs.groupIds.get(p.group) === groupId).map((p) =>
          requireId(productIds, p.sku, 'SKU'),
        );
      }),
    ];
    const targets: Prisma.DiscountTargetCreateManyInput[] = [
      ...productTargets.map((productId) => ({ discountId: discount.id, productId })),
      ...(d.targets.categories ?? []).map((slug) => ({
        discountId: discount.id,
        categoryId: requireId(refs.categoryIds, slug, 'kategoriya'),
      })),
      ...(d.targets.brands ?? []).map((slug) => ({
        discountId: discount.id,
        brandId: requireId(refs.brandIds, slug, 'brend'),
      })),
    ];

    await prisma.$transaction([
      prisma.discountTarget.deleteMany({ where: { discountId: discount.id } }),
      prisma.discountTarget.createMany({ data: targets }),
    ]);
  }
}

/** Kategoriya va uning barcha ota-kategoriyalari (chegirma va qidiruv matni uchun). */
async function categoryPaths(prisma: PrismaClient) {
  const categories = await prisma.category.findMany({
    select: { id: true, parentId: true, name: true },
  });
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (categoryId: string) => {
    const path: { id: string; name: string }[] = [];
    let current = byId.get(categoryId);
    while (current && !path.some((c) => c.id === current!.id)) {
      path.unshift({ id: current.id, name: current.name });
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return path;
  };
}

/**
 * Har bir mahsulotning joriy narxini amaldagi chegirmalar bo'yicha qayta hisoblaydi
 * (API'dagi narx moduli bilan bir xil formula). Kategoriyaga qo'yilgan chegirma
 * barcha subkategoriyalarga ham tegishli.
 */
async function recalculatePrices(prisma: PrismaClient): Promise<number> {
  const now = new Date();
  const discounts = (
    await prisma.discount.findMany({ where: { isActive: true }, include: { targets: true } })
  ).filter((d) => isDiscountActive(d, now));
  const pathOf = await categoryPaths(prisma);

  const products = await prisma.product.findMany({
    select: {
      id: true,
      brandId: true,
      categoryId: true,
      basePrice: true,
      currentPrice: true,
      appliedDiscountId: true,
    },
  });

  let changed = 0;
  for (const product of products) {
    const path = new Set(pathOf(product.categoryId).map((c) => c.id));
    const price = priceProduct(product, discounts, path);
    if (
      price.finalPrice !== product.currentPrice ||
      price.discountId !== product.appliedDiscountId
    ) {
      await prisma.product.update({
        where: { id: product.id },
        data: { currentPrice: price.finalPrice, appliedDiscountId: price.discountId },
      });
      changed += 1;
    }
  }
  return changed;
}

/** Qidiruv matni (API'dagi bilan bir xil): nom, SKU, brend, kategoriya, material, o'lchamlar. */
async function refreshSearchText(prisma: PrismaClient): Promise<void> {
  const pathOf = await categoryPaths(prisma);
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      searchText: true,
      categoryId: true,
      brand: { select: { name: true } },
      material: { select: { name: true, fullName: true } },
      attributeValues: {
        select: {
          numberValue: true,
          textValue: true,
          attribute: { select: { unit: true, type: true } },
        },
      },
    },
  });
  for (const product of products) {
    const text = buildSearchText({
      name: product.name,
      sku: product.sku,
      brand: product.brand.name,
      categories: pathOf(product.categoryId).map((c) => c.name),
      material: product.material,
      attributes: product.attributeValues
        .filter((v) => v.attribute.type !== 'BOOLEAN')
        .map((v) => ({
          unit: v.attribute.unit,
          value: v.numberValue !== null ? String(v.numberValue) : (v.textValue ?? ''),
        })),
    });
    if (text !== product.searchText) {
      await prisma.product.update({ where: { id: product.id }, data: { searchText: text } });
    }
  }
}

async function seedHomeCollections(
  prisma: PrismaClient,
  refs: Awaited<ReturnType<typeof seedReferenceData>>,
  overwrite: boolean,
): Promise<void> {
  for (const c of HOME_COLLECTIONS) {
    const data = {
      title: c.title,
      sortOrder: c.sortOrder,
      materialId: c.material ? requireId(refs.materialIds, c.material, 'material') : null,
      categoryId: c.category ? requireId(refs.categoryIds, c.category, 'kategoriya') : null,
      brandId: c.brand ? requireId(refs.brandIds, c.brand, 'brend') : null,
    };
    await prisma.homeCollection.upsert({
      where: { slug: c.slug },
      update: overwrite ? data : {},
      create: { ...data, slug: c.slug },
    });
  }
}

/** Sozlamalar faqat yo'q bo'lsa yoziladi — admin o'zgartirganlari saqlanib qoladi */
async function seedSettings(prisma: PrismaClient): Promise<void> {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as Prisma.InputJsonValue },
    });
  }
}

interface AdminInput {
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Admin sozlamalarini bazaga hech narsa yozilmasdan oldin tekshiradi. */
function readAdminInput(): AdminInput | null {
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!password) return null;
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD kamida ${ADMIN_PASSWORD_MIN_LENGTH} belgidan iborat bo'lishi kerak ` +
        `(parolda # bo'lsa, .env faylida qiymatni qo'shtirnoqqa oling)`,
    );
  }
  const phone = normalizeUzPhone(process.env.ADMIN_PHONE ?? '');
  if (!phone) {
    throw new Error("ADMIN_PHONE noto'g'ri. Format: +998901234567");
  }
  return {
    phone,
    password,
    firstName: process.env.ADMIN_FIRST_NAME || 'Admin',
    lastName: process.env.ADMIN_LAST_NAME || 'SantexGo',
  };
}

async function seedAdmin(prisma: PrismaClient, input: AdminInput | null): Promise<string> {
  if (!input) {
    return 'ADMIN_PASSWORD berilmagan — admin akkaunt yaratilmadi';
  }
  const { phone } = input;

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    // Mavjud foydalanuvchining paroli o'zgartirilmaydi, faqat admin roli beriladi
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN', isActive: true },
    });
    return `Admin mavjud: ${phone} (parol o'zgartirilmadi)`;
  }

  await prisma.user.create({
    data: {
      phone,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: await hashPassword(input.password),
      role: 'ADMIN',
      phoneVerifiedAt: new Date(),
    },
  });
  return `Admin yaratildi: ${phone}`;
}

async function main(): Promise<void> {
  validateCatalog();
  const adminInput = readAdminInput();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });

  // Production'da (SEED_SAMPLE_PRODUCTS=false) namunaviy mahsulot va chegirmalar yozilmaydi —
  // faqat ma'lumotnomalar (kategoriyalar, materiallar, xususiyatlar, ombor), sozlamalar va admin
  const withSamples = process.env.SEED_SAMPLE_PRODUCTS !== 'false';

  try {
    if (process.env.SEED_SCOPE === 'admin') {
      if (!adminInput)
        throw new Error('SEED_SCOPE=admin uchun ADMIN_PHONE va ADMIN_PASSWORD kerak');
      console.info(`✔ ${await seedAdmin(prisma, adminInput)}`);
      return;
    }
    const messages: string[] = [];
    // Production: ma'lumotnomalar faqat birinchi o'rnatishda — keyin ularni admin boshqaradi
    if (!withSamples && (await prisma.category.count()) > 0) {
      messages.push(
        "Ma'lumotnomalar allaqachon bor — o'zgartirilmadi (admin panel orqali boshqariladi)",
      );
    } else {
      const refs = await seedReferenceData(prisma, withSamples);
      messages.push(
        `Materiallar: ${refs.materialIds.size}, kategoriyalar: ${refs.categoryIds.size}, ` +
          `brendlar: ${refs.brandIds.size}`,
      );
      if (withSamples) {
        const { productIds, restocked } = await seedProducts(prisma, refs);
        await seedDiscounts(prisma, refs, productIds);
        const repriced = await recalculatePrices(prisma);
        await refreshSearchText(prisma);
        messages.push(
          `Mahsulotlar: ${productIds.size} (yangi qoldiq yozilgan: ${restocked}); ` +
            `chegirmalar: ${DISCOUNTS.length}, narxi yangilangan mahsulotlar: ${repriced}`,
        );
      } else {
        messages.push(
          'Namunaviy brend, mahsulot va chegirmalar yozilmadi (SEED_SAMPLE_PRODUCTS=false)',
        );
      }
      await seedHomeCollections(prisma, refs, withSamples);
    }
    await seedSettings(prisma);
    messages.push(await seedAdmin(prisma, adminInput));

    console.info('✔ Seed tugadi');
    for (const message of messages) console.info(`  ${message}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const hint = dbErrorHint(error);
  console.error('✖ Seed xatosi:', hint ?? (error instanceof Error ? error.message : error));
  process.exitCode = 1;
});
