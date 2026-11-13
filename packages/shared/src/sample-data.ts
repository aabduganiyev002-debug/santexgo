/**
 * Seed'ning namunaviy (sinov) ma'lumotlari: SEED_SAMPLE_PRODUCTS=true da yoziladi (Windows paketi,
 * lokal muhit). Haqiqiy katalog yuklangach, admin panelda bir tugma bilan o'chiriladi — aks holda
 * namunaviy chegirmalar (masalan, butun "Kanalizatsiya" kategoriyasiga −5%) haqiqiy mahsulotlarga
 * ham tushadi. Seed shu ro'yxatlar bilan mosligini tekshiradi (apps/api/prisma/seed.ts).
 */
export const SAMPLE_PRODUCT_SKUS: readonly string[] = [
  'PLT-PPR-PN20-20',
  'PLT-PPR-PN20-25',
  'PLT-PPR-PN20-32',
  'PLT-PPR-PN20-40',
  'PLT-PPR-PN20-50',
  'PLT-PPR-PN20-63',
  'VER-PPR-PN20-20',
  'VER-PPR-PN20-25',
  'VER-PPR-PN20-32',
  'PLT-PPR-TRS90-20',
  'PLT-PPR-TRS90-25',
  'PLT-PPR-TRS90-32',
  'PLT-PPR-MFT-20',
  'PLT-PPR-MFT-25',
  'PLT-PPR-MFT-32',
  'PLT-PPR-TRN-20',
  'PLT-PPR-TRN-25',
  'PLT-PPR-TRN-32',
  'VER-PPR-TRS90-20',
  'VER-PPR-TRS90-25',
  'PLT-PVC-PN10-50',
  'PLT-PVC-PN10-63',
  'PLT-PVC-TRS90-50',
  'VER-PVC-KAN-50-1M',
  'VER-PVC-KAN-110-2M',
  'PLT-PP-KAN-50-1M',
  'PLT-PP-KAN-110-2M',
  'VER-PP-KAN-TRS45-110',
  'VER-KRN-SH-12',
  'VER-KRN-SH-34',
  'VER-KRN-SH-1',
  'PLT-PPR-KRN-SH-25',
  'VER-KRC-RAD-12',
  'VER-KRC-MINI-12',
  'VER-KLP-TSK-12',
  'VER-KLP-TSK-34',
  'PLT-ASB-QAYCHI-42',
  'VER-ASB-FUM-19',
];

export const SAMPLE_DISCOUNT_NAMES: readonly string[] = [
  'Kuzgi aksiya: Plastherm PPR trubalar −10%',
  'Vero sharli kran 3/4" uchun 10 000 so‘m chegirma',
  'Kanalizatsiya mahsulotlariga −5%',
];

export const SAMPLE_GROUP_NAMES: readonly string[] = [
  'Plastherm PPR truba PN20',
  'Vero PPR truba PN20',
  'Plastherm PPR tirsak 90°',
  'Plastherm PPR mufta',
  'Plastherm PPR troynik',
  'Vero PPR tirsak 90°',
  'Plastherm PVC truba PN10',
  'Vero PVC kanalizatsiya trubasi',
  'Plastherm PP kanalizatsiya trubasi',
  'Vero sharli kran',
  'Vero teskari klapan',
];

/** Faqat namunaviy mahsulotlar uchun yaratilgan brendlar (Plastherm — haqiqiy brend, qoladi) */
export const SAMPLE_BRAND_SLUGS: readonly string[] = ['vero'];
