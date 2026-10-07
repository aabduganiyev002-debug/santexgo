# SantexGo

Santexnika mahsulotlari (PPR, PVC, PP trubalar, fittinglar, kanalizatsiya, armatura) uchun online do'kon va buyurtma platformasi.

Loyiha bosqichma-bosqich ishlab chiqilmoqda. Hozirgi holat: **2-bosqich tayyor** — ro'yxatdan o'tish (SMS), kirish, parolni tiklash, rollar va himoya.

Platforma qanday tuzilgani (arxitektura, baza, mijoz/admin/buyurtma/chegirma jarayonlari, texnologiyalar): **[docs/ARXITEKTURA.md](docs/ARXITEKTURA.md)**.

## Tarkib

| Papka             | Nima                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- |
| `apps/api`        | Backend API — NestJS 12, Prisma 7, PostgreSQL                                          |
| `apps/web`        | Mijozlar sayti — Next.js (6-bosqich)                                                   |
| `apps/admin`      | Admin panel — Next.js (9-bosqich)                                                      |
| `packages/shared` | Frontend va backend uchun umumiy kod: narx/chegirma hisobi, statuslar, telefon formati |
| `docker`          | Lokal infratuzilma: PostgreSQL, Redis, Meilisearch, SeaweedFS (S3)                     |

## Ishga tushirish

Kompyuterda birinchi marta ishga tushirish bo'yicha qadamma-qadam qo'llanma (Windows va Mac): **[docs/ORNATISH.md](docs/ORNATISH.md)**.

Qisqacha (Node.js 22.12+, pnpm 10 va Docker Desktop o'rnatilgan bo'lsa):

```bash
pnpm setup:local   # sozlamalar, bog'liqliklar, baza, migratsiyalar va namunaviy ma'lumotlar
pnpm dev           # API: http://localhost:4000/api/docs
```

`pnpm setup:local` qayta ishga tushirish xavfsiz — kod yangilangandan keyin ham shuni bering. `.env` fayllari tasodifiy parollar bilan avtomatik yaratiladi va mavjud bo'lsa o'zgartirilmaydi.

Tekshirish:

- API holati: http://localhost:4000/api/health
- API hujjati (Swagger): http://localhost:4000/api/docs
- Baza (Prisma Studio): `pnpm db:studio` → http://localhost:5555

## Asosiy buyruqlar

| Buyruq             | Vazifasi                                                        |
| ------------------ | --------------------------------------------------------------- |
| `pnpm setup:local` | Kompyuterda ishga tushirishga tayyorlash (qayta berish xavfsiz) |
| `pnpm dev`         | Barcha ilovalarni ishlab chiqish rejimida ishga tushiradi       |
| `pnpm build`       | Production build                                                |
| `pnpm check`       | Format, lint, tiplar va testlar — commitdan oldin               |
| `pnpm test:e2e`    | API'ni haqiqiy baza bilan to'liq sinash (e2e testlar)           |
| `pnpm db:migrate`  | Sxema o'zgargandan keyin yangi migratsiya yaratadi              |
| `pnpm db:deploy`   | Migratsiyalarni bazaga qo'llaydi (production ham shu)           |
| `pnpm db:seed`     | Namunaviy katalog va birinchi admin                             |
| `pnpm db:studio`   | Bazani brauzerda ko'rish (Prisma Studio)                        |
| `pnpm infra:up`    | Docker xizmatlarini ishga tushiradi                             |
| `pnpm infra:down`  | Docker konteynerlarini to'xtatadi                               |
| `pnpm infra:reset` | Lokal baza va barcha Docker ma'lumotlarini **o'chiradi**        |

## Kirish va SMS

- Ro'yxatdan o'tish: ism, familiya, telefon, parol → SMS kod → akkaunt yaratiladi va mijoz avtomatik kiradi.
- Kirish: telefon + parol. Parolni unutganda: SMS kod → yangi parol (boshqa qurilmalardagi sessiyalar yopiladi).
- **Lokal kompyuterda SMS yuborilmaydi** (`SMS_PROVIDER=console`): kod `pnpm dev` ishlayotgan terminalda `📱 +998...: SantexGo: ... kodi 123456` ko'rinishida chiqadi.
- Haqiqiy SMS uchun Eskiz.uz: `apps/api/.env` da `SMS_PROVIDER=eskiz`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`. SMS matnlari (`apps/api/src/modules/auth/sms-messages.ts`) Eskiz kabinetida shablon sifatida tasdiqlangan bo'lishi kerak.
- Himoya: parollar Argon2id, sessiya tokenlari httpOnly cookie'da, SMS kod 5 daqiqa / 5 urinish / 60 soniyada bir marta, 10 ta noto'g'ri paroldan keyin raqam 15 daqiqaga bloklanadi, barcha API'ga rate limit, CSRF himoyasi, kunlik SMS limiti.

## Ma'lumotlar bazasi

Sxema: `apps/api/prisma/schema.prisma` — 31 ta jadval (foydalanuvchilar, SMS kodlar, katalog, chegirmalar, ombor, savatcha, buyurtmalar, to'lovlar, sharhlar, sozlamalar, audit).

Muhim qoidalar:

- Pul — butun so'mda (`Int`), kasr son yo'q.
- Har bir o'lcham — alohida SKU, o'z narxi va qoldig'i bilan; bir modelning o'lchamlari `ProductGroup` orqali bog'lanadi.
- Buyurtmada mahsulot nomi, narxi va chegirmasi "muzlatiladi" — keyingi o'zgarishlar eski buyurtmaga ta'sir qilmaydi.
- Buyurtma raqamlari `ORDER-10001` dan boshlanadi.
- Sotuvga mavjud qoldiq = `quantity − reserved`; har bir o'zgarish `inventory_movements` jadvalida tarix sifatida saqlanadi.
- Baza o'zi ham noto'g'ri ma'lumotni rad etadi (CHECK cheklovlar): manfiy qoldiq, 100% dan katta chegirma, summasi mos kelmaydigan buyurtma, manzilsiz yetkazib berish va h.k.

## Seed haqida

`pnpm db:seed` 2 ta brend, 4 ta material, 11 ta kategoriya, 38 ta namunaviy mahsulot, 3 ta chegirma va homepage tugmalarini yaratadi. **Narxlar, qoldiqlar va tavsiflar — namuna**, real savdodan oldin almashtiring.

Birinchi admin `apps/api/.env` dagi `ADMIN_PHONE` va `ADMIN_PASSWORD` dan yaratiladi (parol kamida 10 belgi). Seed'ni qayta ishga tushirish xavfsiz: dublikat yaratilmaydi, ombor qoldiqlari va admin paroli o'zgartirilmaydi.

## Ish rejasi

1. ✅ Loyiha tuzilmasi, infratuzilma, ma'lumotlar bazasi, seed, API asosi
2. ✅ Auth: ro'yxatdan o'tish + SMS, login, parolni tiklash, rollar, rate limit
3. Katalog API: brendlar, kategoriyalar, materiallar, xususiyatlar, mahsulotlar, rasmlar
4. Chegirma va narx moduli
5. Qidiruv va filtrlar (Meilisearch)
6. Mijozlar sayti: homepage, katalog, filtrlar, mahsulot sahifasi, mobil versiya
7. Savatcha, sevimlilar, checkout, buyurtma va ombor
8. Shaxsiy kabinet va buyurtmalar tarixi
9. Admin panel
10. Admin statistika va grafiklar
11. Testlar, xavfsizlik tekshiruvi, serverga deploy, backup
