/**
 * Boshlang'ich katalog ma'lumotlari.
 *
 * Diqqat: mahsulot narxlari, qoldiqlar va tavsiflar — NAMUNA (demo) uchun.
 * Haqiqiy savdodan oldin admin paneldan yoki Excel importi orqali real ma'lumotlar bilan almashtiring.
 */

export type AttributeValue = number | string | boolean;
type Unit = 'PIECE' | 'METER' | 'PACK' | 'SET' | 'KG';

export interface MaterialSeed {
  slug: string;
  name: string;
  fullName: string;
  sortOrder: number;
}

export interface AttributeSeed {
  key: string;
  name: string;
  unit: string | null;
  type: 'NUMBER' | 'TEXT' | 'BOOLEAN';
  isFilterable: boolean;
  sortOrder: number;
}

export interface CategorySeed {
  slug: string;
  name: string;
  parent?: string;
  sortOrder: number;
  /** Shu kategoriyada ishlatiladigan xususiyatlar (Attribute.key) */
  attributes: string[];
}

export interface BrandSeed {
  slug: string;
  name: string;
  isFeatured: boolean;
  sortOrder: number;
}

export interface ProductSeed {
  sku: string;
  name: string;
  brand: string;
  category: string;
  material?: string;
  group?: string;
  unit?: Unit;
  basePrice: number;
  stock: number;
  shortDescription: string;
  description: string;
  isFeatured?: boolean;
  attributes: Record<string, AttributeValue>;
}

export interface GroupSeed {
  name: string;
  variantAttributeKey: string;
}

export interface DiscountSeed {
  name: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  /** Bugundan necha kun amal qiladi */
  durationDays: number;
  targets: { products?: string[]; groups?: string[]; categories?: string[]; brands?: string[] };
}

export interface HomeCollectionSeed {
  slug: string;
  title: string;
  material?: string;
  category?: string;
  brand?: string;
  sortOrder: number;
}

// ───────────────────────────── Ma'lumotnomalar ─────────────────────────────

export const WAREHOUSE = {
  code: 'MAIN',
  name: 'Asosiy ombor',
  address: 'Toshkent',
} as const;

export const MATERIALS: MaterialSeed[] = [
  { slug: 'ppr', name: 'PPR', fullName: 'Polipropilen random sopolimer (PP-R)', sortOrder: 10 },
  { slug: 'pvc', name: 'PVC', fullName: 'Polivinilxlorid', sortOrder: 20 },
  { slug: 'pp', name: 'PP', fullName: 'Polipropilen', sortOrder: 30 },
  { slug: 'latun', name: 'Latun', fullName: 'Latun (mis va rux qotishmasi)', sortOrder: 40 },
];

export const ATTRIBUTES: AttributeSeed[] = [
  {
    key: 'diameter_mm',
    name: 'Diametr',
    unit: 'mm',
    type: 'NUMBER',
    isFilterable: true,
    sortOrder: 10,
  },
  { key: 'pn', name: 'Bosim klassi', unit: null, type: 'TEXT', isFilterable: true, sortOrder: 20 },
  {
    key: 'length_m',
    name: 'Uzunlik',
    unit: 'm',
    type: 'NUMBER',
    isFilterable: true,
    sortOrder: 30,
  },
  {
    key: 'wall_thickness_mm',
    name: 'Devor qalinligi',
    unit: 'mm',
    type: 'NUMBER',
    isFilterable: false,
    sortOrder: 40,
  },
  {
    key: 'angle_deg',
    name: 'Burchak',
    unit: '°',
    type: 'NUMBER',
    isFilterable: true,
    sortOrder: 50,
  },
  {
    key: 'thread_size',
    name: 'Rezba o‘lchami',
    unit: null,
    type: 'TEXT',
    isFilterable: true,
    sortOrder: 60,
  },
  {
    key: 'working_pressure_bar',
    name: 'Ishchi bosim',
    unit: 'bar',
    type: 'NUMBER',
    isFilterable: false,
    sortOrder: 70,
  },
  {
    key: 'max_temperature_c',
    name: 'Maksimal harorat',
    unit: '°C',
    type: 'NUMBER',
    isFilterable: false,
    sortOrder: 80,
  },
  { key: 'color', name: 'Rangi', unit: null, type: 'TEXT', isFilterable: true, sortOrder: 90 },
];

export const CATEGORIES: CategorySeed[] = [
  {
    slug: 'trubalar',
    name: 'Trubalar',
    sortOrder: 10,
    attributes: [
      'diameter_mm',
      'pn',
      'length_m',
      'wall_thickness_mm',
      'max_temperature_c',
      'color',
    ],
  },
  { slug: 'fittinglar', name: 'Fittinglar', sortOrder: 20, attributes: ['diameter_mm', 'pn'] },
  {
    slug: 'tirsaklar',
    name: 'Tirsaklar',
    parent: 'fittinglar',
    sortOrder: 10,
    attributes: ['diameter_mm', 'angle_deg', 'pn'],
  },
  {
    slug: 'muftalar',
    name: 'Muftalar',
    parent: 'fittinglar',
    sortOrder: 20,
    attributes: ['diameter_mm', 'pn'],
  },
  {
    slug: 'troyniklar',
    name: 'Troyniklar',
    parent: 'fittinglar',
    sortOrder: 30,
    attributes: ['diameter_mm', 'pn'],
  },
  {
    slug: 'kanalizatsiya',
    name: 'Kanalizatsiya',
    sortOrder: 30,
    attributes: ['diameter_mm', 'length_m', 'angle_deg', 'color'],
  },
  {
    slug: 'armatura',
    name: 'Santexnika armaturasi',
    sortOrder: 40,
    attributes: ['thread_size', 'working_pressure_bar', 'max_temperature_c'],
  },
  {
    slug: 'kranlar',
    name: 'Kranlar',
    parent: 'armatura',
    sortOrder: 10,
    attributes: ['thread_size', 'diameter_mm', 'working_pressure_bar', 'max_temperature_c'],
  },
  {
    slug: 'kranchalar',
    name: 'Kranchalar',
    parent: 'armatura',
    sortOrder: 20,
    attributes: ['thread_size', 'working_pressure_bar', 'max_temperature_c'],
  },
  {
    slug: 'klapanlar',
    name: 'Klapanlar',
    parent: 'armatura',
    sortOrder: 30,
    attributes: ['thread_size', 'working_pressure_bar', 'max_temperature_c'],
  },
  { slug: 'boshqa', name: 'Boshqa mahsulotlar', sortOrder: 90, attributes: [] },
];

export const BRANDS: BrandSeed[] = [
  { slug: 'plastherm', name: 'Plastherm', isFeatured: true, sortOrder: 10 },
  { slug: 'vero', name: 'Vero', isFeatured: true, sortOrder: 20 },
];

export const GROUPS: GroupSeed[] = [
  { name: 'Plastherm PPR truba PN20', variantAttributeKey: 'diameter_mm' },
  { name: 'Vero PPR truba PN20', variantAttributeKey: 'diameter_mm' },
  { name: 'Plastherm PPR tirsak 90°', variantAttributeKey: 'diameter_mm' },
  { name: 'Plastherm PPR mufta', variantAttributeKey: 'diameter_mm' },
  { name: 'Plastherm PPR troynik', variantAttributeKey: 'diameter_mm' },
  { name: 'Vero PPR tirsak 90°', variantAttributeKey: 'diameter_mm' },
  { name: 'Plastherm PVC truba PN10', variantAttributeKey: 'diameter_mm' },
  { name: 'Vero PVC kanalizatsiya trubasi', variantAttributeKey: 'diameter_mm' },
  { name: 'Plastherm PP kanalizatsiya trubasi', variantAttributeKey: 'diameter_mm' },
  { name: 'Vero sharli kran', variantAttributeKey: 'thread_size' },
  { name: 'Vero teskari klapan', variantAttributeKey: 'thread_size' },
];

// ─────────────────────────────── Mahsulotlar ───────────────────────────────

const PPR_PIPE_TEXT = {
  short: 'Issiq va sovuq suv hamda isitish tizimlari uchun PPR truba.',
  description:
    'Polipropilen (PP-R) truba ichki suv ta’minoti va isitish tizimlari uchun mo‘ljallangan. ' +
    'Diffuziya payvandlash usulida fittinglar bilan ulanadi, zanglamaydi va ichki devorida cho‘kma to‘planmaydi.',
};

const PPR_FITTING_TEXT = {
  short: 'PPR trubalarni payvandlab ulash uchun fitting.',
  description:
    'PPR trubalar bilan diffuziya payvandlash usulida ulanadi. Truba bilan bir xil diametrdagi fittingni tanlang.',
};

const SEWER_TEXT = {
  short: 'Ichki kanalizatsiya tizimlari uchun truba.',
  description:
    'Ichki kanalizatsiya va oqova suv tizimlari uchun. Rezina zichlagichli rastrub orqali tez yig‘iladi.',
};

function pprPipes(
  brand: 'plastherm' | 'vero',
  brandName: string,
  skuPrefix: string,
  group: string,
  sizes: ReadonlyArray<{ d: number; wall: number; price: number; stock: number }>,
): ProductSeed[] {
  return sizes.map(({ d, wall, price, stock }) => ({
    sku: `${skuPrefix}-PPR-PN20-${d}`,
    name: `${brandName} PPR truba Ø${d} PN20, 4 m`,
    brand,
    category: 'trubalar',
    material: 'ppr',
    group,
    basePrice: price,
    stock,
    shortDescription: PPR_PIPE_TEXT.short,
    description: PPR_PIPE_TEXT.description,
    attributes: {
      diameter_mm: d,
      pn: 'PN20',
      length_m: 4,
      wall_thickness_mm: wall,
      max_temperature_c: 95,
      color: 'Oq',
    },
  }));
}

function pprFittings(
  kind: { code: string; title: string; category: string; angle?: number },
  brand: 'plastherm' | 'vero',
  brandName: string,
  skuPrefix: string,
  group: string,
  sizes: ReadonlyArray<{ d: number; price: number; stock: number }>,
): ProductSeed[] {
  return sizes.map(({ d, price, stock }) => ({
    sku: `${skuPrefix}-PPR-${kind.code}-${d}`,
    name: `${brandName} PPR ${kind.title} Ø${d}`,
    brand,
    category: kind.category,
    material: 'ppr',
    group,
    basePrice: price,
    stock,
    shortDescription: PPR_FITTING_TEXT.short,
    description: PPR_FITTING_TEXT.description,
    attributes: {
      diameter_mm: d,
      pn: 'PN25',
      ...(kind.angle === undefined ? {} : { angle_deg: kind.angle }),
    },
  }));
}

export const PRODUCTS: ProductSeed[] = [
  // PPR trubalar
  ...pprPipes('plastherm', 'Plastherm', 'PLT', 'Plastherm PPR truba PN20', [
    { d: 20, wall: 3.4, price: 34_000, stock: 380 },
    { d: 25, wall: 4.2, price: 50_000, stock: 450 },
    { d: 32, wall: 5.4, price: 78_000, stock: 260 },
    { d: 40, wall: 6.7, price: 122_000, stock: 140 },
    { d: 50, wall: 8.3, price: 186_000, stock: 75 },
    // "Sotuvda yo'q" holatini ko'rsatish uchun qoldiq 0
    { d: 63, wall: 10.5, price: 295_000, stock: 0 },
  ]),
  ...pprPipes('vero', 'Vero', 'VER', 'Vero PPR truba PN20', [
    { d: 20, wall: 3.4, price: 30_000, stock: 300 },
    { d: 25, wall: 4.2, price: 44_000, stock: 320 },
    { d: 32, wall: 5.4, price: 69_000, stock: 150 },
  ]),

  // PPR fittinglar
  ...pprFittings(
    { code: 'TRS90', title: 'tirsak 90°', category: 'tirsaklar', angle: 90 },
    'plastherm',
    'Plastherm',
    'PLT',
    'Plastherm PPR tirsak 90°',
    [
      { d: 20, price: 2_500, stock: 1_200 },
      { d: 25, price: 3_800, stock: 1_500 },
      { d: 32, price: 6_500, stock: 800 },
    ],
  ),
  ...pprFittings(
    { code: 'MFT', title: 'mufta', category: 'muftalar' },
    'plastherm',
    'Plastherm',
    'PLT',
    'Plastherm PPR mufta',
    [
      { d: 20, price: 1_800, stock: 1_000 },
      { d: 25, price: 2_700, stock: 1_100 },
      { d: 32, price: 4_600, stock: 600 },
    ],
  ),
  ...pprFittings(
    { code: 'TRN', title: 'troynik', category: 'troyniklar' },
    'plastherm',
    'Plastherm',
    'PLT',
    'Plastherm PPR troynik',
    [
      { d: 20, price: 3_000, stock: 900 },
      { d: 25, price: 4_500, stock: 950 },
      { d: 32, price: 7_800, stock: 400 },
    ],
  ),
  ...pprFittings(
    { code: 'TRS90', title: 'tirsak 90°', category: 'tirsaklar', angle: 90 },
    'vero',
    'Vero',
    'VER',
    'Vero PPR tirsak 90°',
    [
      { d: 20, price: 2_100, stock: 700 },
      { d: 25, price: 3_200, stock: 650 },
    ],
  ),

  // PVC bosimli trubalar va fittinglar
  ...[
    { d: 50, price: 98_000, stock: 60 },
    { d: 63, price: 135_000, stock: 45 },
  ].map(({ d, price, stock }): ProductSeed => ({
    sku: `PLT-PVC-PN10-${d}`,
    name: `Plastherm PVC truba Ø${d} PN10, 4 m`,
    brand: 'plastherm',
    category: 'trubalar',
    material: 'pvc',
    group: 'Plastherm PVC truba PN10',
    basePrice: price,
    stock,
    shortDescription: 'Sovuq suv ta’minoti va sug‘orish tizimlari uchun PVC truba.',
    description:
      'Polivinilxlorid (PVC) bosimli truba sovuq suv ta’minoti, sug‘orish va texnik suv tizimlari uchun.',
    attributes: { diameter_mm: d, pn: 'PN10', length_m: 4, color: 'Kulrang' },
  })),
  {
    sku: 'PLT-PVC-TRS90-50',
    name: 'Plastherm PVC tirsak 90° Ø50',
    brand: 'plastherm',
    category: 'tirsaklar',
    material: 'pvc',
    basePrice: 9_500,
    stock: 220,
    shortDescription: 'PVC trubalarni 90° burchak ostida ulash uchun.',
    description: 'PVC bosimli trubalar uchun tirsak. Truba bilan bir xil diametrda tanlanadi.',
    attributes: { diameter_mm: 50, angle_deg: 90, pn: 'PN10' },
  },

  // Kanalizatsiya
  ...[
    { d: 50, length: 1, price: 18_000, stock: 400 },
    { d: 110, length: 2, price: 85_000, stock: 180 },
  ].map(({ d, length, price, stock }): ProductSeed => ({
    sku: `VER-PVC-KAN-${d}-${length}M`,
    name: `Vero PVC kanalizatsiya trubasi Ø${d}, ${length} m`,
    brand: 'vero',
    category: 'kanalizatsiya',
    material: 'pvc',
    group: 'Vero PVC kanalizatsiya trubasi',
    basePrice: price,
    stock,
    shortDescription: SEWER_TEXT.short,
    description: SEWER_TEXT.description,
    attributes: { diameter_mm: d, length_m: length, color: 'Kulrang' },
  })),
  ...[
    { d: 50, length: 1, price: 15_000, stock: 500 },
    { d: 110, length: 2, price: 72_000, stock: 210 },
  ].map(({ d, length, price, stock }): ProductSeed => ({
    sku: `PLT-PP-KAN-${d}-${length}M`,
    name: `Plastherm PP kanalizatsiya trubasi Ø${d}, ${length} m`,
    brand: 'plastherm',
    category: 'kanalizatsiya',
    material: 'pp',
    group: 'Plastherm PP kanalizatsiya trubasi',
    basePrice: price,
    stock,
    shortDescription: SEWER_TEXT.short,
    description: SEWER_TEXT.description,
    attributes: { diameter_mm: d, length_m: length, color: 'Kulrang' },
  })),
  {
    sku: 'VER-PP-KAN-TRS45-110',
    name: 'Vero PP kanalizatsiya tirsagi 45° Ø110',
    brand: 'vero',
    category: 'kanalizatsiya',
    material: 'pp',
    basePrice: 14_000,
    stock: 300,
    shortDescription: 'Kanalizatsiya trubalarini 45° burchak ostida ulash uchun.',
    description: 'Ichki kanalizatsiya tizimlari uchun rastrubli tirsak.',
    attributes: { diameter_mm: 110, angle_deg: 45, color: 'Kulrang' },
  },

  // Kranlar
  ...[
    { thread: '1/2"', code: '12', price: 65_000, stock: 120 },
    { thread: '3/4"', code: '34', price: 89_000, stock: 85 },
    // Kam qolgan qoldiq (ogohlantirish chegarasi 10 dan past)
    { thread: '1"', code: '1', price: 135_000, stock: 6 },
  ].map(({ thread, code, price, stock }): ProductSeed => ({
    sku: `VER-KRN-SH-${code}`,
    name: `Vero sharli kran ${thread}`,
    brand: 'vero',
    category: 'kranlar',
    material: 'latun',
    group: 'Vero sharli kran',
    basePrice: price,
    stock,
    isFeatured: true,
    shortDescription: 'Suv ta’minoti tizimlari uchun latun sharli kran.',
    description:
      'Latun korpusli sharli kran suv oqimini tez ochish va yopish uchun. Rezbali ulanish.',
    attributes: { thread_size: thread, working_pressure_bar: 25, max_temperature_c: 120 },
  })),
  {
    sku: 'PLT-PPR-KRN-SH-25',
    name: 'Plastherm PPR sharli kran Ø25',
    brand: 'plastherm',
    category: 'kranlar',
    material: 'ppr',
    basePrice: 38_000,
    stock: 140,
    shortDescription: 'PPR trubalar tizimiga payvandlanadigan sharli kran.',
    description:
      'PPR trubalarga diffuziya payvandlash orqali ulanadi, alohida o‘tkazgich talab qilmaydi.',
    attributes: { diameter_mm: 25, working_pressure_bar: 25, max_temperature_c: 95 },
  },

  // Kranchalar
  {
    sku: 'VER-KRC-RAD-12',
    name: 'Vero radiator kranchasi 1/2", burchakli',
    brand: 'vero',
    category: 'kranchalar',
    material: 'latun',
    basePrice: 55_000,
    stock: 90,
    shortDescription: 'Isitish radiatorlarini ulash uchun burchakli krancha.',
    description: 'Radiatorga issiq suv kirishini boshqarish uchun burchakli krancha.',
    attributes: { thread_size: '1/2"', working_pressure_bar: 16, max_temperature_c: 110 },
  },
  {
    sku: 'VER-KRC-MINI-12',
    name: 'Vero mini krancha 1/2"',
    brand: 'vero',
    category: 'kranchalar',
    material: 'latun',
    basePrice: 24_000,
    stock: 260,
    shortDescription: 'Santexnika asboblarini ulash uchun ixcham krancha.',
    description: 'Unitaz bachogi, smesitel va maishiy texnikani suv tarmog‘iga ulash uchun.',
    attributes: { thread_size: '1/2"', working_pressure_bar: 16, max_temperature_c: 90 },
  },

  // Klapanlar
  ...[
    { thread: '1/2"', code: '12', price: 42_000, stock: 110 },
    { thread: '3/4"', code: '34', price: 56_000, stock: 70 },
  ].map(({ thread, code, price, stock }): ProductSeed => ({
    sku: `VER-KLP-TSK-${code}`,
    name: `Vero teskari klapan ${thread}`,
    brand: 'vero',
    category: 'klapanlar',
    material: 'latun',
    group: 'Vero teskari klapan',
    basePrice: price,
    stock,
    shortDescription: 'Suvning teskari oqimini to‘sadigan klapan.',
    description:
      'Nasos va suv isitgichlar oldidan o‘rnatiladi, suv orqaga qaytishiga yo‘l qo‘ymaydi.',
    attributes: { thread_size: thread, working_pressure_bar: 16, max_temperature_c: 100 },
  })),

  // Boshqa mahsulotlar
  {
    sku: 'PLT-ASB-QAYCHI-42',
    name: 'Plastherm PPR truba qaychisi Ø16–42',
    brand: 'plastherm',
    category: 'boshqa',
    basePrice: 120_000,
    stock: 35,
    shortDescription: 'PPR trubalarni tekis kesish uchun qaychi.',
    description: 'Diametri 42 mm gacha bo‘lgan PPR va PE trubalarni tekis kesish uchun.',
    attributes: {},
  },
  {
    sku: 'VER-ASB-FUM-19',
    name: 'Vero FUM lenta 19 mm',
    brand: 'vero',
    category: 'boshqa',
    basePrice: 6_000,
    stock: 1_000,
    shortDescription: 'Rezbali birikmalarni zichlash uchun lenta.',
    description: 'Rezbali ulanishlarda suv sizib chiqmasligi uchun o‘raladigan zichlovchi lenta.',
    attributes: {},
  },
];

// ─────────────────────────── Chegirmalar va homepage ───────────────────────────

export const DISCOUNTS: DiscountSeed[] = [
  {
    name: 'Kuzgi aksiya: Plastherm PPR trubalar −10%',
    type: 'PERCENT',
    value: 10,
    durationDays: 30,
    targets: { groups: ['Plastherm PPR truba PN20'] },
  },
  {
    name: 'Vero sharli kran 3/4" uchun 10 000 so‘m chegirma',
    type: 'FIXED',
    value: 10_000,
    durationDays: 14,
    targets: { products: ['VER-KRN-SH-34'] },
  },
  {
    name: 'Kanalizatsiya mahsulotlariga −5%',
    type: 'PERCENT',
    value: 5,
    durationDays: 30,
    targets: { categories: ['kanalizatsiya'] },
  },
];

/** Homepage'dagi "Material bo'yicha" tugmalari */
export const HOME_COLLECTIONS: HomeCollectionSeed[] = [
  { slug: 'ppr-truba', title: 'PPR TRUBA', material: 'ppr', category: 'trubalar', sortOrder: 10 },
  { slug: 'pvc-truba', title: 'PVC TRUBA', material: 'pvc', category: 'trubalar', sortOrder: 20 },
  { slug: 'pp-truba', title: 'PP TRUBA', material: 'pp', sortOrder: 30 },
  {
    slug: 'ppr-fitting',
    title: 'PPR FITTING',
    material: 'ppr',
    category: 'fittinglar',
    sortOrder: 40,
  },
  { slug: 'pvc', title: 'PVC', material: 'pvc', sortOrder: 50 },
  { slug: 'kanalizatsiya', title: 'KANALIZATSIYA', category: 'kanalizatsiya', sortOrder: 60 },
  { slug: 'armatura', title: 'ARMATURA', category: 'armatura', sortOrder: 70 },
];

/** Sayt sozlamalari (admin paneldan o'zgartiriladi) */
export const SETTINGS: Record<string, unknown> = {
  store: { name: 'SantexGo', phone: '', email: '', address: '', workingHours: '' },
  delivery: { baseFee: 30_000, freeFrom: 1_000_000, pickupEnabled: true },
};
