/**
 * Boshlang'ich ma'lumotlar: ombor, materiallar, xususiyatlar, kategoriyalar, brendlar,
 * namunaviy mahsulotlar, chegirmalar, homepage tugmalari, sozlamalar va birinchi admin.
 *
 * Qayta ishga tushirish xavfsiz: mavjud yozuvlar yangilanadi, dublikat yaratilmaydi,
 * mavjud ombor qoldiqlari va admin paroli o'zgartirilmaydi.
 *
 * Ishga tushirish: pnpm db:seed
 */
import { PrismaPg } from '@prisma/adapter-pg';
import {
  calculatePrice,
  isDiscountActive,
  normalizeUzPhone,
  slugify,
  type DiscountRule,
} from '@santexgo/shared';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { ADMIN_PASSWORD_MIN_LENGTH, hashPassword } from '../src/common/security/password.js';
import { dbErrorHint } from '../src/infra/prisma/db-error-hint.js';
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

async function seedReferenceData(prisma: PrismaClient) {
  const warehouse = await prisma.warehouse.upsert({
    where: { code: WAREHOUSE.code },
    update: {},
    create: { ...WAREHOUSE, isDefault: true },
  });

  const materialIds = new Map<string, string>();
  for (const m of MATERIALS) {
    const row = await prisma.material.upsert({
      where: { slug: m.slug },
      update: { name: m.name, fullName: m.fullName, sortOrder: m.sortOrder },
      create: m,
    });
    materialIds.set(m.slug, row.id);
  }

  const attributeIds = new Map<string, string>();
  for (const a of ATTRIBUTES) {
    const row = await prisma.attribute.upsert({ where: { key: a.key }, update: a, create: a });
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
      update: data,
      create: { ...data, slug: c.slug },
    });
    categoryIds.set(c.slug, row.id);

    for (const [index, key] of c.attributes.entries()) {
      const attributeId = requireId(attributeIds, key, 'xususiyat');
      await prisma.categoryAttribute.upsert({
        where: { categoryId_attributeId: { categoryId: row.id, attributeId } },
        update: { sortOrder: index },
        create: { categoryId: row.id, attributeId, sortOrder: index },
      });
    }
  }

  const brandIds = new Map<string, string>();
  for (const b of BRANDS) {
    const row = await prisma.brand.upsert({ where: { slug: b.slug }, update: b, create: b });
    brandIds.set(b.slug, row.id);
  }

  const groupIds = new Map<string, string>();
  for (const g of GROUPS) {
    const existing = await prisma.productGroup.findFirst({ where: { name: g.name } });
    const row = existing
      ? await prisma.productGroup.update({ where: { id: existing.id }, data: g })
      : await prisma.productGroup.create({ data: g });
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

/**
 * Har bir mahsulotning joriy narxini amaldagi chegirmalar bo'yicha qayta hisoblaydi.
 * Kategoriyaga qo'yilgan chegirma uning barcha subkategoriyalariga ham tegishli.
 * (Keyingi bosqichda bu mantiq Pricing moduliga ko'chadi.)
 */
async function recalculatePrices(prisma: PrismaClient): Promise<number> {
  const now = new Date();
  const discounts = (
    await prisma.discount.findMany({ where: { isActive: true }, include: { targets: true } })
  ).filter((d) => isDiscountActive(d, now));

  const categories = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]));
  const withAncestors = (categoryId: string): Set<string> => {
    const result = new Set<string>();
    let current: string | null | undefined = categoryId;
    while (current && !result.has(current)) {
      result.add(current);
      current = parentOf.get(current);
    }
    return result;
  };

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
    const categoryIds = withAncestors(product.categoryId);
    const rules: DiscountRule[] = discounts
      .filter((d) =>
        d.targets.some(
          (t) =>
            t.productId === product.id ||
            t.brandId === product.brandId ||
            (t.categoryId !== null && categoryIds.has(t.categoryId)),
        ),
      )
      .map((d) => ({ id: d.id, type: d.type, value: d.value, priority: d.priority }));

    const price = calculatePrice(product.basePrice, rules);
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

async function seedHomeAndSettings(
  prisma: PrismaClient,
  refs: Awaited<ReturnType<typeof seedReferenceData>>,
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
      update: data,
      create: { ...data, slug: c.slug },
    });
  }

  // Sozlamalar faqat yo'q bo'lsa yoziladi — admin o'zgartirganlari saqlanib qoladi
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

  try {
    const refs = await seedReferenceData(prisma);
    const { productIds, restocked } = await seedProducts(prisma, refs);
    await seedDiscounts(prisma, refs, productIds);
    const repriced = await recalculatePrices(prisma);
    await seedHomeAndSettings(prisma, refs);
    const adminMessage = await seedAdmin(prisma, adminInput);

    console.info('✔ Seed tugadi');
    console.info(
      `  Materiallar: ${refs.materialIds.size}, kategoriyalar: ${refs.categoryIds.size}, brendlar: ${refs.brandIds.size}`,
    );
    console.info(`  Mahsulotlar: ${productIds.size} (yangi qoldiq yozilgan: ${restocked})`);
    console.info(`  Chegirmalar: ${DISCOUNTS.length}, narxi yangilangan mahsulotlar: ${repriced}`);
    console.info(`  ${adminMessage}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const hint = dbErrorHint(error);
  console.error('✖ Seed xatosi:', hint ?? (error instanceof Error ? error.message : error));
  process.exitCode = 1;
});
