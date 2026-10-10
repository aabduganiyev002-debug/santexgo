# SantexGo

Santexnika mahsulotlari (PPR, PVC, PP trubalar, fittinglar, kanalizatsiya, armatura) uchun online do'kon va buyurtma platformasi.

Loyiha bosqichma-bosqich ishlab chiqildi. Hozirgi holat: **10-bosqich tayyor** — mijozlar sayti (katalog, qidiruv, savatcha, buyurtma, kabinet), admin panel (statistika va grafiklar, buyurtmalar, mahsulotlar, ombor, chegirmalar, mijozlar bazasi, kontent) va serverga joylash (Docker, avtomatik HTTPS, kunlik backup). Kelajakdagi imkoniyatlar (Click/Payme/Uzum, Telegram bot va boshqalar) — [ARXITEKTURA.md, 12-bo'lim](docs/ARXITEKTURA.md#12-kelajakda-kengaytirish).

Platforma qanday tuzilgani (arxitektura, baza, mijoz/admin/buyurtma/chegirma jarayonlari, texnologiyalar): **[docs/ARXITEKTURA.md](docs/ARXITEKTURA.md)**.

## Tarkib

| Papka                            | Nima                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/api`                       | Backend API — NestJS 12, Prisma 7, PostgreSQL                                                        |
| `apps/web`                       | Mijozlar sayti — Next.js 16, React 19, Tailwind CSS 4                                                |
| `apps/admin`                     | Admin panel — Next.js, http://localhost:3001                                                         |
| `apps/*/Dockerfile`              | Production image'lar: API (va migratsiyalar uchun `migrate`), sayt, admin panel                      |
| `packages/shared`                | Frontend va backend uchun umumiy kod: narx/chegirma hisobi, statuslar, telefon formati               |
| `packages/ui`                    | Sayt va admin panel uchun umumiy UI komponentlar, API klient, dizayn tokenlari, CSP (`src/csp.ts`)   |
| `docker/docker-compose.yml`      | Lokal infratuzilma: PostgreSQL, Redis (ixtiyoriy: SeaweedFS — S3 sinovi uchun)                       |
| `docker/docker-compose.prod.yml` | Production: sayt, admin panel, API, baza, Redis, Caddy va backup — bitta serverda                    |
| `docker/Caddyfile`               | HTTPS (Let's Encrypt), domenlar, xavfsizlik sarlavhalari, admin API izolyatsiyasi                    |
| `docker/backup`                  | Kunlik zaxira (baza va yuklangan fayllar) va tiklash skriptlari                                      |
| `scripts`                        | `setup.mjs` — kompyuterda o'rnatish (`pnpm setup:local`); `prod.sh` — production serverni boshqarish |

## Ishga tushirish

Kompyuterda birinchi marta ishga tushirish bo'yicha qadamma-qadam qo'llanma (Windows va Mac): **[docs/ORNATISH.md](docs/ORNATISH.md)**.

Qisqacha (Node.js 22.12+, pnpm 10 va Docker Desktop o'rnatilgan bo'lsa):

```bash
pnpm setup:local   # sozlamalar, bog'liqliklar, baza, migratsiyalar va namunaviy ma'lumotlar
pnpm dev           # sayt: http://localhost:3000, API: http://localhost:4000/api/docs
```

`pnpm setup:local` qayta ishga tushirish xavfsiz — kod yangilangandan keyin ham shuni bering. `.env` fayllari tasodifiy parollar bilan avtomatik yaratiladi va mavjud bo'lsa o'zgartirilmaydi.

Tekshirish:

- Sayt: http://localhost:3000
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

## Production'ga joylash

Serverga (Ubuntu 24.04 VPS) o'rnatish, yangilash, zaxira nusxalar va muammolarni hal qilish bo'yicha qadamma-qadam qo'llanma: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

Bitta serverda Docker Compose bilan: Caddy (avtomatik HTTPS), sayt, admin panel, API, PostgreSQL, Redis va kunlik backup. Server tayyor va DNS sozlangan bo'lsa, loyiha papkasida:

```bash
sh scripts/prod.sh init santexgo.uz admin.santexgo.uz siz@example.com  # sozlamalar, parollar avtomatik
nano docker/.env.production                                            # Eskiz SMS: ESKIZ_EMAIL, ESKIZ_PASSWORD
sh scripts/prod.sh deploy                                              # build, migratsiyalar, HTTPS, ishga tushirish
sh scripts/prod.sh seed                                                # kategoriyalar, materiallar, ombor
sh scripts/prod.sh admin                                               # admin akkaunt
```

Yangilash: `git pull && sh scripts/prod.sh deploy` — `deploy` avval bazaning zaxira nusxasini oladi, migratsiyalar avtomatik qo'llanadi, versiya vaqt va commit bilan belgilanadi (masalan, `20261010-064215-5b48e2d`; rollback uchun oxirgi 5 tasi saqlanadi). Boshqa buyruqlar: `status`, `logs`, `backups`, `restore <fayl>`, `versions`, `rollback <versiya>` — `sh scripts/prod.sh` ro'yxatni ko'rsatadi.

## Kirish va SMS

- Ro'yxatdan o'tish: ism, familiya, telefon, parol → SMS kod → akkaunt yaratiladi va mijoz avtomatik kiradi.
- Kirish: telefon + parol. Parolni unutganda: SMS kod → yangi parol (boshqa qurilmalardagi sessiyalar yopiladi).
- **Lokal kompyuterda SMS yuborilmaydi** (`SMS_PROVIDER=console`): kod `pnpm dev` ishlayotgan terminalda `📱 +998...: SantexGo: ... kodi 123456` ko'rinishida chiqadi.
- Haqiqiy SMS uchun Eskiz.uz: `apps/api/.env` da `SMS_PROVIDER=eskiz`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`. SMS matnlari (`apps/api/src/modules/auth/sms-messages.ts`) Eskiz kabinetida shablon sifatida tasdiqlangan bo'lishi kerak.
- Himoya: parollar Argon2id, sessiya tokenlari httpOnly cookie'da, SMS kod 5 daqiqa / 5 urinish / 60 soniyada bir marta, 10 ta noto'g'ri paroldan keyin raqam 15 daqiqaga bloklanadi, barcha API'ga rate limit, CSRF himoyasi, kunlik SMS limiti.
- Sayt va admin panel: har so'rovda yangi nonce bilan qat'iy Content-Security-Policy (begona skript bajarilmaydi; ilova CSP bermagan javoblarga Caddy eng qat'iy standart CSP qo'yadi), HSTS; kirishdan keyingi `?next=` manzili tekshiriladi (boshqa saytga yo'naltirib bo'lmaydi). Admin API faqat admin domeni orqali ishlaydi (sayt domenida yopiq); production'da API'ning CORS ro'yxati ataylab bo'sh va Caddy `/api` ga begona `Origin` bilan kelgan so'rovlarni `403` bilan rad etadi — sayt va admin panel bir-birining API'sini brauzerdan chaqira olmaydi. Serverda tashqariga faqat 80/443 (IPv4) ochiq — baza va Redis ichki tarmoqda.
- Production'da SMS sozlamalari `docker/.env.production` da — [docs/DEPLOY.md](docs/DEPLOY.md).

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

`pnpm db:seed` 2 ta brend, 4 ta material, 11 ta kategoriya, 38 ta namunaviy mahsulot (rasmsiz), 3 ta chegirma va homepage tugmalarini yaratadi. **Narxlar, qoldiqlar va tavsiflar — namuna**, real savdodan oldin almashtiring.

Birinchi admin `apps/api/.env` dagi `ADMIN_PHONE` va `ADMIN_PASSWORD` dan yaratiladi (parol kamida 10 belgi). Seed'ni qayta ishga tushirish xavfsiz: dublikat yaratilmaydi, ombor qoldiqlari, sozlamalar va admin paroli o'zgartirilmaydi.

Production'da (`SEED_SAMPLE_PRODUCTS=false`) seed faqat ma'lumotnomalarni yozadi — ombor, materiallar, xususiyatlar, kategoriyalar, "Material bo'yicha" tugmalari va sozlamalar; brend, variant guruhi, mahsulot va chegirmalar yozilmaydi. Ma'lumotnomalar faqat birinchi o'rnatishda (bazada kategoriya bo'lmaganda) yoziladi; qayta berilsa, faqat yo'q sozlamalar qo'shiladi — [docs/DEPLOY.md](docs/DEPLOY.md#54-malumotnomalar-seed).

## Katalog va qidiruv

API hujjati (Swagger) — http://localhost:4000/api/docs, "Katalog" va "Admin: ..." bo'limlari.

- **Filtrlar birgalikda:** `/api/v1/catalog/products?brand=plastherm&material=ppr&diameter_mm=25&pn=PN20&priceMin=50000&priceMax=200000` — har bir filtr qiymati yonida nechta mahsulot borligi qaytadi.
- **Qidiruv** nom, SKU, brend, kategoriya, material va o'lchamlar bo'yicha: "Plastherm 25 PN20", xato yozuv ("plasterm"), kirill ("пвх труба 50"), xalq tili ("quvur" → truba, "otvod" → tirsak). Alohida qidiruv serveri kerak emas — PostgreSQL'ning o'zida (pg_trgm).
- **Ombor:** sotuvda mavjud qoldiq bazadagi trigger orqali avtomatik hisoblanadi; har bir o'zgarish tarixga yoziladi. Qoldiq 0 bo'lsa mahsulot "Sotuvda yo'q" bo'ladi va ro'yxat oxiriga tushadi.
- **Rasmlar** yuklanganda tekshiriladi va WebP formatida 3 o'lchamga (1600/800/400 px) keltiriladi. Standart holatda `apps/api/uploads` papkasida saqlanadi; production'da server diskida yoki S3 (Cloudflare R2) da — `docker/.env.production` da bir nechta qator ([docs/DEPLOY.md](docs/DEPLOY.md)).
- **Admin amallari** (yaratish, tahrirlash, o'chirish, ombor) `audit_logs` jurnaliga yoziladi. Buyurtmalarda bor mahsulot o'chirilmaydi — arxivlanadi.

## Mijozlar sayti

- **Bosh sahifa:** bannerlar slayderi, mashhur brendlar, "Material bo'yicha" (telefonda suriladi), chegirmalar, yangi va ommabop mahsulotlar, kategoriyalar.
- **Katalog:** filtrlar (kategoriya, mavjudlik, brend, material, narx, diametr, PN...) har bir qiymat yonida soni bilan; tanlanganlar "chip" ko'rinishida; saralash; sahifalash. Filtrlar URL'da saqlanadi — havolani yuborish mumkin. Telefonda filtrlar pastdan ochiladigan oynada.
- **Qidiruv:** yozish jarayonida takliflar (mahsulot rasmi va narxi bilan), klaviatura bilan boshqariladi.
- **Brend sahifasi:** brend bo'limlari (PPR TRUBA, PVC TRUBA...) va filtrlar.
- **Mahsulot sahifasi:** rasmlar, narx (eski narx ustidan chiziq, −15%, chegirma tugash vaqti), qoldiq, o'lcham variantlari, miqdor, "Savatchaga qo'shish" va "Hozir sotib olish", texnik xususiyatlar, sertifikatlar, yetkazib berish, o'xshash mahsulotlar.
- **Kirish:** telefon + parol; ro'yxatdan o'tish SMS kod bilan; parolni tiklash.
- **SEO:** har bir sahifa uchun sarlavha va tavsif, Google uchun tuzilgan ma'lumotlar (Product, BreadcrumbList), `sitemap.xml`, `robots.txt`.
- **Telefon:** pastki menyu (Bosh sahifa, Katalog, Brendlar, Savatcha, Kabinet), doim ko'rinadigan qidiruv.

## Savatcha va buyurtmalar

- **Savatcha** kirmagan mijoz uchun brauzerda saqlanadi; kirgandan keyin akkauntga qo'shiladi va telefon/kompyuterda bir xil bo'ladi. Narx, chegirma, qoldiq va yetkazib berish narxini har doim server hisoblaydi. Qoldiq yetmasa yoki mahsulot sotuvdan olinsa — savatchada aniq ko'rsatiladi ("Omborda faqat 5 dona qoldi" + "5 tani qoldirish").
- **Buyurtma berish:** ism, familiya, telefon, yetkazib berish yoki do'kondan olib ketish, manzil (saqlangan yoki yangi), to'lov turi (naqd / yetkazilganda karta; Click, Payme, Uzum — keyingi bosqichlarda), izoh. Natija: `ORDER-10254` raqamli buyurtma.
- **Ishonchlilik:** hammasi bitta tranzaksiyada — qoldiq qulflanib tekshiriladi (oxirgi dona uchun ikki mijoz bir vaqtda bossa, faqat bittasi oladi), narxlar buyurtmada "muzlatiladi", tugma ikki marta bosilsa ham bitta buyurtma yaratiladi, ekrandagi summa o'zgargan bo'lsa mijoz ogohlantiriladi.
- **Ombor:** omborda 450 dona, mijoz 10 dona buyurtma qilsa — saytda darhol "440" ko'rinadi (band qilinadi). Buyurtma yo'lga chiqqanda jismoniy qoldiq kamayadi; bekor qilinsa — band bo'shaydi, yo'lga chiqqan bo'lsa mahsulot omborga qaytadi. Har bir harakat buyurtma raqami bilan tarixga yoziladi.
- **Statuslar:** Buyurtma qabul qilindi → Tasdiqlanmoqda → Tayyorlanmoqda → Yetkazib berilmoqda → Yetkazildi (yoki Bekor qilindi). Admin oraliq bosqichni o'tkazib yuborishi mumkin (masalan, olib ketishda). Mijoz buyurtmani tayyorlanishidan oldin o'zi bekor qila oladi. "Yetkazildi" bo'lganda naqd/karta to'lovi "to'langan" bo'ladi va mahsulotning sotilganlar soni oshadi.
- **Himoya:** bitta mijozda tasdiqlanmagan buyurtmalar soni cheklangan (soxta buyurtmalar bilan omborni band qilib qo'yishdan), buyurtma berish so'rovlari soni cheklangan.
- **SMS xabarnoma** (ixtiyoriy, `ORDER_SMS_ENABLED=true`): buyurtma qabul qilindi, yo'lga chiqdi, yetkazildi, bekor qilindi.
- **Sevimlilar:** mahsulot kartochkasidagi yurakcha, `/favorites` sahifasi.

## Shaxsiy kabinet

- **Umumiy:** jami buyurtmalar, hozirgi buyurtmalar, jami xarid summasi (yetkazilgan buyurtmalar bo'yicha), sevimlilar va asosiy manzil.
- **Buyurtmalarim:** barcha / hozirgi / yakunlangan; har bir buyurtmada holat bosqichlari (vaqti bilan), mahsulotlar, summa, manzil, to'lov. Tasdiqlanishidan oldin bekor qilish (sabab bilan) va "Qayta buyurtma berish" (mahsulotlar joriy narxda savatchaga qo'shiladi).
- **Manzillar:** bir nechta manzil, asosiy manzil checkout'da avtomatik tanlanadi.
- **Profil va xavfsizlik:** ism-familiya; telefon raqamini yangi raqamga kelgan SMS kod bilan o'zgartirish; parolni o'zgartirish (joriy parol talab qilinadi, boshqa qurilmalardan chiqiladi).
- Kabinet va checkout sahifalari kirmagan foydalanuvchini kirish sahifasiga yo'naltiradi (kirgandan keyin shu sahifaga qaytadi).

## Admin panel

http://localhost:3001 — faqat ADMIN roli bilan (seed yaratgan admin akkaunt).

- **Bosh sahifa (statistika):** bugungi buyurtmalar va savdo (kechaga nisbatan), shu oy savdosi (o'tgan oyning shu kunlariga nisbatan), tasdiqlanmagan buyurtmalar, mijozlar soni; davr (7/30/90 kun, 12 oy) bo'yicha savdo grafigi (tooltip, klaviatura, jadval ko'rinishi), buyurtmalar holati, eng ko'p sotilgan mahsulotlar va brendlar, eng ko'p xarid qilgan mijozlar, ombor holati (yetarli / kam / yo'q). Savdo — bekor qilinmagan buyurtmalar summasi, do'kon vaqt zonasida (Asia/Tashkent).
- **Buyurtmalar:** statuslar bo'yicha bo'limlar (soni bilan), raqam/telefon/ism bo'yicha qidiruv, sana filtri; yangi buyurtmalar soni menyuda har daqiqada yangilanadi. Buyurtma kartochkasi: mahsulotlar, mijoz (qo'ng'iroq havolasi, buyurtmalar tarixi), manzil, mijoz izohi, holatni o'zgartirish (ombor oqibatlari tushuntiriladi), to'lov holati, ichki izoh, holat tarixi (kim va qachon), chop etish.
- **Mahsulotlar:** ro'yxat (brend, kategoriya, material, qoldiq, holat filtrlari; saralash), qo'shish va tahrirlash: SKU, narx, birlik, eng kam miqdor, texnik xususiyatlar (kategoriyaga biriktirilganlari avtomatik chiqadi), SEO; rasmlar (bir nechtasi birdan, asosiy rasm, tartib), sertifikatlar (PDF), ombor: kirim, chiqim, inventarizatsiya va harakatlar tarixi; arxivlash/o'chirish.
- **Kategoriyalar** (daraxt, filtr xususiyatlari, rasm), **brendlar** (logotip, mashhur), **materiallar, xususiyatlar, variant guruhlari**, omborlar.
- **Chegirmalar:** foiz yoki summa, muddat, ustuvorlik; mahsulot (qidirib), kategoriya va brendlarga; qaysi mahsulotlarga qo'llangani va narxlari.
- **Mijozlar bazasi:** ism, telefon, buyurtmalar soni, umumiy xarid summasi, oxirgi buyurtma; saralash; mijoz kartochkasi; bloklash.
- **Bannerlar va bosh sahifa:** slayder (kompyuter va telefon rasmi, muddat), "Material bo'yicha" tugmalari; **sozlamalar:** do'kon aloqalari, yetkazib berish narxi va bepul chegarasi.
- Barcha o'zgarishlar audit jurnaliga yoziladi. Sayt va admin panel umumiy UI paketidan foydalanadi (`packages/ui`).

## Chegirmalar

- Admin foizli (−15%) yoki aniq summali (−10 000 so'm) chegirma yaratadi: boshlanish va tugash sanasi, mahsulot, kategoriya (ichki kategoriyalari bilan) yoki brendga.
- Bir mahsulotga bir nechta chegirma tegishli bo'lsa — mijoz uchun eng foydalisi qo'llanadi (ustma-ust qo'shilmaydi).
- Chegirma belgilangan vaqtda o'zi boshlanadi va tugaydi (server har daqiqada tekshiradi).
- Saytda: asl narx, chegirmali narx, foiz va chegirma tugash vaqti qaytadi.
- Buyurtmadagi narx "muzlatiladi" — chegirma keyin o'zgarsa ham eski buyurtma summasi o'zgarmaydi.

## Sayt kontenti

Admin bosh sahifa bannerlarini (kompyuter va telefon uchun alohida rasm, muddat), "Material bo'yicha" tugmalarini va do'kon sozlamalarini (telefon, manzil, ish vaqti, yetkazib berish narxi va bepul chegarasi) o'zgartiradi.

## Ish rejasi

1. ✅ Loyiha tuzilmasi, infratuzilma, ma'lumotlar bazasi, seed, API asosi
2. ✅ Auth: ro'yxatdan o'tish + SMS, login, parolni tiklash, rollar, rate limit
3. ✅ Katalog API, qidiruv va filtrlar; admin: mahsulotlar, rasmlar, brendlar, kategoriyalar, materiallar, xususiyatlar, ombor
4. ✅ Chegirmalar moduli (foizli/summali, muddatli, avtomatik), bannerlar, material tugmalari, sozlamalar
5. ✅ Mijozlar sayti: homepage, katalog, filtrlar, qidiruv, mahsulot sahifasi, kirish, mobil versiya
6. ✅ Savatcha, sevimlilar, checkout, buyurtma va ombor; admin buyurtmalar API'si
7. ✅ Shaxsiy kabinet: buyurtmalar tarixi va holati, manzillar, profil, parol va telefonni o'zgartirish
8. ✅ Admin panel: buyurtmalar, mahsulotlar, ombor, kategoriyalar, brendlar, chegirmalar, mijozlar bazasi, bannerlar, sozlamalar
9. ✅ Admin statistika va grafiklar
10. ✅ Xavfsizlik tekshiruvi, serverga deploy, backup
