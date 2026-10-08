# SantexGo'ni serverga joylash (production)

Bu qo'llanma SantexGo'ni internetda ishlaydigan serverga o'rnatish, yangilash, zaxira nusxalarini saqlash va muammolarni hal qilish bo'yicha. Kompyuterda ishga tushirish — [ORNATISH.md](ORNATISH.md), platforma qanday tuzilgani — [ARXITEKTURA.md](ARXITEKTURA.md).

Birinchi o'rnatish taxminan 1–2 soat oladi (ko'p qismi DNS yangilanishini va birinchi build'ni kutish). Keyin yangi versiyani o'rnatish — bitta qator buyruq.

Barcha buyruqlar serverda, loyiha papkasida (`~/santexgo`) beriladi. Serverni boshqarishning asosiy vositasi — `sh scripts/prod.sh` skripti: buyruqsiz ishga tushirilsa, buyruqlar ro'yxatini ko'rsatadi (to'liq ro'yxat — [11-bo'lim](#11-buyruqlar-royxati)).

Mundarija:

1. [Nima o'rnatiladi](#1-nima-ornatiladi)
2. [Server tanlash](#2-server-tanlash)
3. [Domen va DNS](#3-domen-va-dns)
4. [Serverni tayyorlash](#4-serverni-tayyorlash)
5. [Birinchi o'rnatish](#5-birinchi-ornatish)
6. [Yangilash va orqaga qaytish](#6-yangilash-va-orqaga-qaytish)
7. [Zaxira nusxalar (backup)](#7-zaxira-nusxalar-backup)
8. [Kuzatish va loglar](#8-kuzatish-va-loglar)
9. [Xavfsizlik](#9-xavfsizlik)
10. [Muammolar va yechimlar](#10-muammolar-va-yechimlar)
11. [Buyruqlar ro'yxati](#11-buyruqlar-royxati)

**Qisqacha** (server tayyor va Docker o'rnatilgan bo'lsa):

```
sh scripts/prod.sh init santexgo.uz admin.santexgo.uz siz@example.com
nano docker/.env.production      # ESKIZ_EMAIL va ESKIZ_PASSWORD
sh scripts/prod.sh deploy        # build, migratsiyalar, HTTPS va ishga tushirish
sh scripts/prod.sh seed          # kategoriyalar, materiallar, ombor
sh scripts/prod.sh admin         # admin akkaunt

# Keyinchalik yangilash:
sh scripts/prod.sh backup && git pull && sh scripts/prod.sh deploy
```

## 1. Nima o'rnatiladi

Hammasi bitta serverda, Docker konteynerlarida ishlaydi (`docker/docker-compose.prod.yml`, Docker loyihasi nomi — `santexgo-prod`):

```
                    Internet (mijozlar va admin)
                                 │  80/443, HTTP → HTTPS
                                 ▼
  caddy ── HTTPS sertifikat (Let's Encrypt), HSTS, siqish, yo'naltirish
    │
    ├── SITE_DOMAIN/*                          ──▶  web    (mijozlar sayti, Next.js)
    ├── SITE_DOMAIN/api/*, ADMIN_DOMAIN/api/*  ──▶  api    (backend, NestJS)
    ├── ADMIN_DOMAIN/*                         ──▶  admin  (admin panel, Next.js)
    └── www.SITE_DOMAIN/*                      ──▶  SITE_DOMAIN ga yo'naltirish (301)

  web ──▶ api            sahifalarni serverda tayyorlash (ichki tarmoq orqali)
  api ──▶ internet       Eskiz.uz (SMS), S3 (ixtiyoriy)

  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ichki "backend" tarmoq — internetdan ko'rinmaydi ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  api     ──▶ postgres (baza), redis (kesh, so'rov limitlari)
  migrate ──▶ postgres   har deploy'da yangi migratsiyalar, keyin to'xtaydi
  backup  ──▶ postgres   har kuni zaxira ──▶ docker/backups/ (server diski)
```

| Xizmat     | Vazifasi                                                                                                           | Ma'lumotlari qayerda                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `caddy`    | Internetga ochiq yagona xizmat (80, 443). HTTPS sertifikatlarini o'zi oladi va yangilaydi, so'rovlarni taqsimlaydi | `caddy_data` hajmi (sertifikatlar)                |
| `web`      | Mijozlar sayti                                                                                                     | —                                                 |
| `admin`    | Admin panel                                                                                                        | —                                                 |
| `api`      | Butun biznes mantiq: katalog, narx, buyurtma, ombor, SMS                                                           | `uploads` hajmi (rasmlar, PDF — lokal saqlashda)  |
| `migrate`  | Har `deploy`'da bazaga yangi migratsiyalarni qo'llaydi va to'xtaydi; `seed` va `admin` buyruqlari ham shu orqali   | —                                                 |
| `postgres` | PostgreSQL 16 — asosiy baza                                                                                        | `postgres_data` hajmi                             |
| `redis`    | So'rov limitlari (rate limit) va kesh                                                                              | `redis_data` hajmi                                |
| `backup`   | Har kuni baza va yuklangan fayllar zaxirasi                                                                        | `BACKUP_DIR` papkasi (standart: `docker/backups`) |

Himoya va ishonchlilik o'z-o'zidan sozlangan:

- Admin API (`/api/v1/admin/...`) faqat admin domeni orqali ishlaydi — sayt domenida Caddy `404` qaytaradi.
- Baza va Redis ichki tarmoqda: internetdan ko'rinmaydi va o'zi internetga chiqa olmaydi.
- Ilovalar root'siz ishlaydi, ortiqcha Linux imtiyozlari olib tashlangan; API kodi faqat o'qish uchun (yozish faqat `uploads` ga).
- Har bir xizmat logi 50 MB dan oshmaydi (5 × 10 MB, eskilari o'chadi).
- Server qayta yuklansa, hamma xizmatlar o'zi ishga tushadi (`sh scripts/prod.sh stop` bilan to'xtatilganlaridan tashqari).

Serverga Node.js, pnpm yoki PostgreSQL o'rnatish shart emas — hammasi Docker image'lari ichida build qilinadi. Faqat Docker va git kerak.

## 2. Server tanlash

Kerak: Ubuntu 24.04 LTS o'rnatilgan VPS (virtual server).

|                 | Eng kam                           | Tavsiya etiladi |
| --------------- | --------------------------------- | --------------- |
| Protsessor      | 2 vCPU                            | 4 vCPU          |
| Operativ xotira | 4 GB (+ 4 GB swap, 4.7-qadam)     | 8 GB            |
| Disk            | 40 GB SSD                         | 80 GB SSD/NVMe  |
| Tizim           | Ubuntu 24.04 LTS, 64-bit (x86_64) |                 |
| Tarmoq          | Doimiy (statik) IPv4 manzil       |                 |

- Eng ko'p resurs **build** (image'larni yig'ish) paytida kerak: birinchi `deploy` server kuchiga qarab 10–30 daqiqa davom etadi va xotirani ko'p ishlatadi. Ishlash paytida esa hamma xizmatlar birgalikda bo'sh turganda taxminan 0,5 GB RAM ishlatadi.
- Diskni Docker image'lari, build keshi (bir necha GB), rollback uchun saqlanadigan oxirgi 5 versiya, baza va zaxira nusxalar egallaydi.
- ARM (arm64) serverlarda sinab ko'rilmagan — x86_64 (amd64) ni tanlang.

**Qayerda joylashtirish:**

|                       | O'zbekistondagi data-markaz                                       | Xorijdagi provayder                            |
| --------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| Mijozlar uchun tezlik | Eng tez (javob vaqti eng kichik)                                  | Yaqin davlatlar va Yevropadan odatda yaxshi    |
| Qonunchilik           | Shaxsiy ma'lumotlarni O'zbekistonda saqlash talabiga mos          | Pastdagi izohni o'qing                         |
| Narx va to'lov        | So'mda, shartnoma bilan                                           | Ko'pincha arzonroq; xalqaro bank kartasi kerak |
| Qo'shimcha imkoniyat  | Provayderga qarab — snapshot va firewall paneli borligini so'rang | Snapshot, firewall, monitoring odatda tayyor   |

> **Qonunchilik.** "Shaxsga doir ma'lumotlar to'g'risida"gi qonun (27¹-modda) O'zbekiston fuqarolarining shaxsiy ma'lumotlarini O'zbekiston hududidagi serverlarda to'plash va saqlashni talab qiladi. Sayt mijozlarning ismi, telefoni va manzilini saqlaydi, shuning uchun serverni (va zaxira nusxalarini) O'zbekistonda joylashtirish xavfsizroq yo'l. Aniq talablar (jumladan, ma'lumotlar bazasini ro'yxatdan o'tkazish) bo'yicha yurist bilan maslahatlashing.

Provayder tanlashda tekshiring:

- KVM (to'liq virtual mashina) — Docker ishlashi uchun; ba'zi arzon "konteyner" VPS'larda (OpenVZ, LXC) Docker ishlamaydi.
- Ubuntu 24.04 LTS tayyor image'i va SSH kalit bilan kirish.
- 80 va 443 portlar ochilishi mumkin, chiquvchi internet (Docker Hub, npm) cheklanmagan.
- Snapshot (butun serverning nusxasi) — ixtiyoriy, lekin katta o'zgarishlardan oldin foydali.

## 3. Domen va DNS

Domen sotib oling (`.uz` domenlari akkreditatsiyalangan registratorlar orqali) va uning DNS panelida server IP manziliga qaratilgan **3 ta A yozuv** yarating:

| Turi | Nomi (Host) | Qiymati   | Nima uchun                                  |
| ---- | ----------- | --------- | ------------------------------------------- |
| A    | `@`         | Server IP | Sayt: `santexgo.uz`                         |
| A    | `www`       | Server IP | `www.santexgo.uz` → `santexgo.uz` ga o'tadi |
| A    | `admin`     | Server IP | Admin panel: `admin.santexgo.uz`            |

- Admin panel domeni boshqacha bo'lishi mumkin (masalan, `panel.santexgo.uz`) — u `init` buyrug'ida beriladi; DNS'da ham aynan shu nom bo'lsin.
- Yangi yozuvlar odatda 5–30 daqiqada, ba'zan bir necha soatda tarqaladi. Shuning uchun DNS'ni birinchi bo'lib sozlang — server tayyorlanguncha tarqalib bo'ladi.
- Tekshirish (kompyuteringizda yoki serverda) — har biri server IP'sini ko'rsatishi kerak:

  ```
  nslookup santexgo.uz
  nslookup www.santexgo.uz
  nslookup admin.santexgo.uz
  ```

- **AAAA (IPv6)** yozuv faqat server IPv6 manziliga ega bo'lsa va u aynan shu serverniki bo'lsa qo'shilsin. Noto'g'ri yoki eski AAAA yozuv sertifikat olishni buzadi.
- **Cloudflare** DNS'ida yozuvlar **"DNS only"** (kulrang bulut) bo'lishi kerak. Proksi (to'q sariq bulut) yoqilsa, API barcha mijozlarni Cloudflare IP manzillari orqali ko'radi va so'rov limitlari noto'g'ri ishlaydi.
- HTTPS sertifikatini olish uchun Let's Encrypt serverga **80 va 443 portlar** orqali ulanadi: DNS to'g'ri va portlar ochiq bo'lishi shart. DNS hali tarqalmagan bo'lsa ham `deploy` ishlaydi — Caddy sertifikatni keyinroq o'zi qayta urinib oladi.
- `www` yozuvi bo'lmasa, faqat `www.santexgo.uz` ishlamaydi (Caddy logida shu nom uchun xato chiqadi), asosiy sayt ishlayveradi.

## 4. Serverni tayyorlash

### 4.1. SSH kalit (kompyuteringizda, bir marta)

Windows 10/11 (PowerShell) yoki Mac (Terminal):

```
ssh-keygen -t ed25519 -C "santexgo"
```

Saqlash joyini so'raganda Enter bosing; kalit uchun parol (passphrase) qo'yish tavsiya etiladi. Ochiq kalitni ko'rish:

- Windows: `Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub`
- Mac: `cat ~/.ssh/id_ed25519.pub`

Server yaratishda shu matnni provayder paneliga **SSH key** sifatida qo'ying. Server allaqachon parol bilan yaratilgan bo'lsa, Mac'da: `ssh-copy-id root@SERVER_IP`. Maxfiy kalit (`id_ed25519`, `.pub` siz) hech kimga berilmaydi.

### 4.2. Birinchi kirish va yangilash

```
ssh root@SERVER_IP
apt update && apt upgrade -y
reboot
```

1–2 daqiqadan keyin qayta ulaning. Ba'zi provayderlar `root` o'rniga `ubuntu` foydalanuvchisini beradi (`ssh ubuntu@SERVER_IP`) — unda buyruqlar oldiga `sudo` qo'shing va 4.3-qadam o'rniga shu foydalanuvchidan foydalanishingiz mumkin.

### 4.3. Alohida foydalanuvchi

Har kuni `root` bilan ishlash xavfli. `deploy` nomli foydalanuvchi yarating (parol so'raladi — `sudo` uchun kerak, parol menejerida saqlang) va SSH kalitingizni unga ham bering:

```
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

Yangi terminal oynasida tekshiring: `ssh deploy@SERVER_IP`, keyin `sudo whoami` → `root`. Bundan keyin hamma ish `deploy` foydalanuvchisi bilan.

### 4.4. SSH'ni himoyalash

Faqat kalit bilan kirish va `root` kirishini o'chirish:

```
sudo tee /etc/ssh/sshd_config.d/00-santexgo.conf > /dev/null <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
sudo sshd -t && sudo systemctl restart ssh
```

Fayl nomi `00-` bilan boshlanadi: SSH sozlamalarni alifbo tartibida o'qiydi va birinchi qiymat ustun bo'ladi (provayderning `50-cloud-init.conf` fayli parol bilan kirishni yoqib qo'ygan bo'lishi mumkin).

**Joriy oynani yopmang!** Yangi oynada `ssh deploy@SERVER_IP` ishlashini tekshiring; `ssh root@SERVER_IP` endi rad etilishi kerak. Ixtiyoriy: `sudo apt install -y fail2ban` — SSH'ga parol terib ko'ruvchi IP'larni vaqtincha bloklaydi.

### 4.5. Firewall (ufw)

```
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status
```

`443/udp` — HTTP/3 uchun. Provayder panelida tashqi firewall bo'lsa, unda ham 22, 80, 443 (TCP) va 443 (UDP) ochiq bo'lsin.

> **Muhim:** Docker konteyner portlarini ufw'ni chetlab ochadi. Bu loyihada tashqariga faqat Caddy'ning 80/443 portlari chiqarilgan, PostgreSQL va Redis esa umuman chiqarilmagan — shuning uchun xavfsiz. `docker/docker-compose.prod.yml` dagi `postgres` yoki `redis` xizmatiga hech qachon `ports:` qo'shmang: ufw uni to'smaydi va baza internetga ochilib qoladi. Bazaga kirish kerak bo'lsa — `sh scripts/prod.sh psql`.

### 4.6. Avtomatik xavfsizlik yangilanishlari

```
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

Savolga **Yes** deb javob bering. Ubuntu xavfsizlik yangilanishlarini har kuni o'zi o'rnatadi. Docker paketlari va qayta yuklashni talab qiladigan yangilanishlar — oyiga bir marta qo'lda ([8.5](#8-kuzatish-va-loglar)).

### 4.7. Swap (RAM 4 GB va undan kam bo'lsa)

Build paytida xotira yetmasligining oldini oladi:

```
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

`free -h` da `Swap:` qatorida 4 GB ko'rinadi. Serverda swap allaqachon bo'lsa (`swapon --show` biror narsa chiqaradi), bu qadamni o'tkazib yuboring.

### 4.8. Docker o'rnatish

Docker'ning rasmiy skripti Docker'ning rasmiy apt repozitoriyasini qo'shadi va Docker Engine hamda Compose plaginini o'rnatadi (keyingi yangilanishlar oddiy `apt upgrade` bilan keladi):

```
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
exit
```

Qayta ulaning (`ssh deploy@SERVER_IP`) — guruh o'zgarishi yangi sessiyada kuchga kiradi. Tekshirish:

```
docker version
docker compose version
```

Ubuntu'ning o'zidagi `docker.io` yoki `docker-compose` paketlarini o'rnatmang — ular eski bo'lishi mumkin. Qo'lda o'rnatish yo'riqnomasi: https://docs.docker.com/engine/install/ubuntu/.

> `docker` guruhidagi foydalanuvchi amalda root huquqiga ega — bu guruhga faqat serverni boshqaradigan odamni qo'shing.

### 4.9. Kodni yuklab olish

Repozitoriy yopiq (private), shuning uchun server uchun alohida, faqat o'qish huquqli **deploy key** yarating:

```
ssh-keygen -t ed25519 -C "santexgo-server" -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

GitHub'da `santexgo` repozitoriyasi → **Settings → Deploy keys → Add deploy key**: Title — `server`, Key — chiqqan matn, **Allow write access** belgilanmasin → **Add key**. Keyin serverda:

```
git clone git@github.com:aabduganiyev002-debug/santexgo.git ~/santexgo
cd ~/santexgo
```

Birinchi ulanishda `Are you sure you want to continue connecting` → `yes`.

Muqobil yo'l — HTTPS va faqat shu repozitoriy uchun "fine-grained" token (Contents: Read-only): `git clone https://github.com/aabduganiyev002-debug/santexgo.git ~/santexgo`, so'ralganda Username — GitHub login, Password — token.

## 5. Birinchi o'rnatish

### 5.1. Sozlamalar faylini yaratish

```
cd ~/santexgo
sh scripts/prod.sh init santexgo.uz admin.santexgo.uz siz@example.com
```

Uchta qiymat: sayt domeni, admin panel domeni (kichik harflar bilan) va email (Let's Encrypt sertifikat muddati haqidagi xabarlar uchun). Qiymatlarsiz `sh scripts/prod.sh init` berilsa, skript ularni o'zi so'raydi.

Natija — `docker/.env.production` fayli: faqat sizning foydalanuvchingiz o'qiy oladi (huquqlari 600), `POSTGRES_PASSWORD`, `REDIS_PASSWORD` va `AUTH_SECRET` tasodifiy qiymatlar bilan to'ldiriladi. Fayl mavjud bo'lsa, `init` uni ustidan yozmaydi.

### 5.2. Sozlamalarni to'ldirish

```
nano docker/.env.production
```

(saqlash: **Ctrl + O**, Enter; chiqish: **Ctrl + X**). Qiymatda `$` belgisi, bo'shliq yoki `#` bo'lsa, uni bittalik qo'shtirnoqqa oling: `ESKIZ_PASSWORD='pa$$word'`.

| O'zgaruvchi                                     | Nima                                                    | Nima qilish kerak                         |
| ----------------------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `SITE_DOMAIN`, `ADMIN_DOMAIN`, `ACME_EMAIL`     | Domenlar va sertifikat email'i                          | `init` yozgan — tekshiring                |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD`           | Baza va Redis parollari (faqat harf va raqam)           | `init` yaratgan — **tegmang**             |
| `AUTH_SECRET`                                   | Tokenlar va SMS kodlarni imzolash kaliti                | `init` yaratgan — **tegmang**             |
| `POSTGRES_DB`, `POSTGRES_USER`                  | Baza va foydalanuvchi nomi (`santexgo`)                 | Tegmang                                   |
| `SMS_PROVIDER`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD` | Eskiz.uz SMS                                            | **Majburiy** — pastga qarang              |
| `SMS_SENDER`                                    | Jo'natuvchi nomi yoki raqami (Eskiz'da tasdiqlangan)    | Standart `4546`                           |
| `SMS_DAILY_LIMIT`                               | Bir kunda yuboriladigan SMS'lar chegarasi               | Standart 2000                             |
| `ORDER_SMS_ENABLED`                             | Buyurtma holati haqida mijozga SMS                      | `true` — shablonlar tasdiqlangandan keyin |
| `STORAGE_DRIVER` va `S3_*`, `MEDIA_*`           | Rasmlar qayerda saqlanadi                               | Pastga qarang                             |
| `APP_TIMEZONE`                                  | Do'kon vaqt zonasi (statistika uchun)                   | `Asia/Tashkent`                           |
| `DATABASE_POOL_SIZE`                            | API'dan bazaga ulanishlar soni                          | Standart 10                               |
| `SEED_SAMPLE_PRODUCTS`                          | `seed` namunaviy mahsulot va chegirmalarni ham yozsinmi | `false` (`true` — faqat sinov serveri)    |
| `BACKUP_CRON`, `BACKUP_KEEP_DAYS`, `BACKUP_DIR` | Zaxira nusxalar jadvali, muddati va papkasi             | [7-bo'lim](#7-zaxira-nusxalar-backup)     |

Faylda yo'q, lekin qo'shish mumkin: `ACCESS_TOKEN_TTL_MINUTES` (standart 15, 1–60) va `REFRESH_TOKEN_TTL_DAYS` (standart 30, 1–180) — necha kundan keyin mijoz qayta kirishi kerak.

**Eskiz SMS (majburiy).** Ro'yxatdan o'tish va parolni tiklash SMS kod bilan ishlaydi, shuning uchun production'da API Eskiz sozlamalarisiz ishga tushmaydi.

1. eskiz.uz'da ro'yxatdan o'ting, shartnoma tuzing va balansni to'ldiring.
2. `ESKIZ_EMAIL` va `ESKIZ_PASSWORD` — Eskiz kabinetiga kirish email'i va paroli.
3. Eskiz kabinetida quyidagi SMS matnlarini shablon sifatida tasdiqlatib oling. Tasdiqlanmagan matn yuborilmaydi — ro'yxatdan o'tish ishlamaydi. O'zgaruvchi qismlar: kod, buyurtma raqami va summa; qolgani harfma-harf mos bo'lishi kerak:

| Qachon                        | SMS matni                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Ro'yxatdan o'tish             | `SantexGo: ro'yxatdan o'tish kodi 123456. Kodni hech kimga bermang.`                                              |
| Parolni tiklash               | `SantexGo: parolni tiklash kodi 123456. Kodni hech kimga bermang.`                                                |
| Telefon raqamini o'zgartirish | `SantexGo: telefon raqamini tasdiqlash kodi 123456. Kodni hech kimga bermang.`                                    |
| Buyurtma qabul qilindi\*      | `SantexGo: buyurtmangiz qabul qilindi. Raqami: ORDER-10254. Jami: 1 250 000 so'm. Operator tez orada bog'lanadi.` |
| Buyurtma yo'lga chiqdi\*      | `SantexGo: ORDER-10254 buyurtmangiz yo'lga chiqdi.`                                                               |
| Buyurtma yetkazildi\*         | `SantexGo: ORDER-10254 buyurtmangiz yetkazildi. Xaridingiz uchun rahmat!`                                         |
| Buyurtma bekor qilindi\*      | `SantexGo: ORDER-10254 buyurtmangiz bekor qilindi.`                                                               |

\* Faqat `ORDER_SMS_ENABLED=true` bo'lsa. Matnlar manbasi: `apps/api/src/modules/auth/sms-messages.ts` va `apps/api/src/modules/notifications/order-notifications.service.ts`.

**Fayllar (rasmlar, logotiplar, PDF): `local` yoki `s3`.** Turini boshidanoq tanlang: bazada faqat fayl kaliti saqlanadi, to'liq manzil `MEDIA_PUBLIC_URL` + kalit. Keyin `local` dan `s3` ga o'tilsa, mavjud fayllarni bucket'ga xuddi shu yo'llar bilan qo'lda ko'chirish kerak bo'ladi.

- `STORAGE_DRIVER=local` (standart) — server diskida (`uploads` Docker hajmi), har kuni zaxiralanadi. Kichik va o'rta katalog uchun yetarli. `MEDIA_PUBLIC_URL=/api/media`, `MEDIA_ORIGIN` bo'sh qoladi.
- `STORAGE_DRIVER=s3` — Cloudflare R2, AWS S3 yoki boshqa S3-mos xizmat. Bucket ochiq o'qiladigan bo'lishi kerak (rasmlar brauzerga to'g'ridan-to'g'ri beriladi). Masalan, Cloudflare R2 va `media.santexgo.uz` domeni bilan:

  ```
  STORAGE_DRIVER=s3
  S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  S3_REGION=auto
  S3_BUCKET=santexgo-media
  S3_ACCESS_KEY=...
  S3_SECRET_KEY=...
  S3_FORCE_PATH_STYLE=false
  MEDIA_PUBLIC_URL=https://media.santexgo.uz
  MEDIA_ORIGIN=https://media.santexgo.uz
  ```

  `MEDIA_ORIGIN` — rasmlar beriladigan domen: sahifalarning xavfsizlik siyosati (CSP) faqat shu domendan rasm yuklashga ruxsat beradi. `S3_FORCE_PATH_STYLE=true` — faqat MinIO va SeaweedFS uchun. S3'dagi fayllarni server zaxirasi saqlamaydi — provayderning o'zida versiyalash yoki zaxirani yoqing.

### 5.3. Ishga tushirish

```
sh scripts/prod.sh deploy
```

Buyruq:

1. Sozlamalar to'liqligini tekshiradi.
2. PostgreSQL, Redis va Caddy image'larining yangi (xavfsizlik tuzatishlari bilan) versiyalarini yuklaydi.
3. API, sayt, admin panel, migrate va backup image'larini build qiladi. Versiya — joriy git commit (masalan, `a724448`).
4. Bazaga yangi migratsiyalarni qo'llaydi, hamma xizmatlarni ishga tushiradi va ular sog'lom ("healthy") bo'lishini 5 daqiqagacha kutadi.
5. Eski versiyalarni tozalaydi — rollback uchun oxirgi 5 tasi qoladi.

Oxirida `▸ Tayyor (versiya ...)` va sayt hamda admin panel manzillari chiqadi. Birinchi marta 10–30 daqiqa ketadi; keyingilari keshdan foydalanib tezroq.

https://santexgo.uz ochilishini tekshiring (katalog hozircha bo'sh). Brauzer sertifikat xatosini ko'rsatsa — DNS hali tarqalmagan yoki port yopiq: [10-bo'lim](#10-muammolar-va-yechimlar).

### 5.4. Ma'lumotnomalar (seed)

```
sh scripts/prod.sh seed
```

Bazaga faqat yo'qlari yoziladi, mavjudlariga tegilmaydi (qayta berish xavfsiz): asosiy ombor, materiallar (PPR, PVC, PP, Latun), 11 ta kategoriya va ularning filtr xususiyatlari (diametr, PN...), 2 ta brend (Plastherm, Vero), bosh sahifadagi "Material bo'yicha" tugmalari va do'kon sozlamalari (yetkazib berish 30 000 so'm, 1 000 000 so'mdan bepul). Namunaviy mahsulot va chegirmalar yozilmaydi (`SEED_SAMPLE_PRODUCTS=false`). Katalog saytda 1 daqiqa ichida yangilanadi (API keshi).

### 5.5. Admin akkaunt

```
sh scripts/prod.sh admin
```

Skript admin telefon raqamini (`+998901234567` ko'rinishida) va parolni (kamida 10 belgi, ekranda ko'rinmaydi) so'raydi. Natija: `✔ Admin yaratildi: +998...`.

- Raqam saytda allaqachon ro'yxatdan o'tgan bo'lsa, o'sha akkauntga admin huquqi beriladi, paroli esa o'zgarmaydi (`Admin mavjud: ... (parol o'zgartirilmadi)`).
- Bir nechta admin kerak bo'lsa — buyruqni har biri uchun takrorlang.
- Yangi admin "Admin SantexGo" nomi bilan yaratiladi — ismni saytdagi kabinetda o'zgartirish mumkin.

### 5.6. Admin panelga kirish va do'konni sozlash

https://admin.santexgo.uz → telefon va parol. Birinchi ishlar:

1. **Sozlamalar** — do'kon telefoni, manzili, ish vaqti; yetkazib berish narxi va bepul yetkazish chegarasi.
2. **Brendlar**, **Kategoriyalar**, **Materiallar va xususiyatlar** — tekshiring, keraksizini o'zgartiring yoki o'chiring.
3. **Mahsulotlar** — qo'shing: narx, rasmlar, qoldiq (ombor kirimi).
4. **Bannerlar va bosh sahifa** — slayder va "Material bo'yicha" tugmalari.

**Admin parolini o'zgartirish.** Admin panelda parol sahifasi yo'q — parol saytdagi kabinetda o'zgartiriladi: https://santexgo.uz/login sahifasida shu telefon va parol bilan kiring → **Kabinet → Profil va xavfsizlik → Parol → Parolni o'zgartirish**. Joriy parol so'raladi; boshqa qurilmalardagi sessiyalar (jumladan, admin panel) yopiladi — admin panelga yangi parol bilan qayta kiring.

### 5.7. Tekshirish ro'yxati

- [ ] https://santexgo.uz ochiladi, manzil satrida qulf belgisi bor
- [ ] http://santexgo.uz va https://www.santexgo.uz → https://santexgo.uz ga o'tadi
- [ ] https://santexgo.uz/api/health → `"status":"ok"`
- [ ] https://admin.santexgo.uz → kirish sahifasi, admin bilan kirish ishlaydi
- [ ] O'z telefoningiz bilan saytda ro'yxatdan o'ting — SMS kod keladi
- [ ] Sinov buyurtma bering, admin panelda ko'ring va bekor qiling
- [ ] `sh scripts/prod.sh status` — hamma xizmatlar `Up` va `(healthy)` (`caddy` da healthcheck yo'q — `Up` yetarli)
- [ ] `sh scripts/prod.sh backups` — kamida bitta zaxira (backup xizmati ishga tushganda birinchisini o'zi yaratadi)
- [ ] Serverdan tashqariga zaxira nusxa sozlandi (7.3)
- [ ] Tashqi monitoring sozlandi (8.4)

## 6. Yangilash va orqaga qaytish

### 6.1. Yangi versiyani o'rnatish

```
cd ~/santexgo
sh scripts/prod.sh backup
git pull
sh scripts/prod.sh deploy
```

- Bazaga yangi migratsiyalar avtomatik qo'llanadi — qo'lda hech narsa qilinmaydi.
- Build paytida eski versiya ishlashda davom etadi. Build xato bilan to'xtasa, sayt eski versiyada qoladi.
- Faqat almashish paytida (API, sayt va admin panel qayta ishga tushganda) taxminan 1 daqiqagacha sayt javob bermasligi mumkin (`502` xato). Yangilashni mijozlar kam paytda qiling.
- `backup` — ehtiyot uchun: migratsiyalar orqaga qaytarilmaydi (6.3).
- `deploy` har safar PostgreSQL, Redis, Caddy va Node.js bazaviy image'larining xavfsizlik yangilanishlarini ham oladi. Kod o'zgarmagan bo'lsa ham oyiga bir marta `deploy` qiling.

### 6.2. Sozlamani o'zgartirgandan keyin

`docker/.env.production` o'zgartirilgandan keyin:

```
sh scripts/prod.sh start
```

Sozlamasi o'zgargan xizmatlar yangi qiymatlar bilan qayta yaratiladi (build qilinmaydi). Domen o'zgarsa (avval DNS'ni sozlang) — `deploy`: sayt manzili build paytida kodga yoziladi. `restart` buyrug'i yangi sozlamalarni **o'qimaydi**.

### 6.3. Versiyalar va orqaga qaytish (rollback)

Yangi versiyada muammo chiqsa, oldingisiga qaytish mumkin:

```
sh scripts/prod.sh versions
sh scripts/prod.sh rollback a724448
```

`versions` saqlangan versiyalarni (git commit qisqa kodi va yaratilgan vaqti) ko'rsatadi; qaysi commit nima ekani — `git log --oneline -10`. Qaytish bir daqiqa atrofida (build qilinmaydi).

- **Baza migratsiyalari orqaga qaytarilmaydi.** Yangi versiya bazani o'zgartirgan bo'lsa, eski kod u bilan to'g'ri ishlamasligi mumkin. Unda yangilashdan oldingi zaxirani tiklang (7.4).
- Keyingi `deploy` yana git'dagi joriy kodni build qiladi — muammo tuzatilmaguncha `deploy` qilmang.

## 7. Zaxira nusxalar (backup)

### 7.1. Nima, qachon va qayerda saqlanadi

| Nima                                                             | Qayerda (serverda)                                      | Qancha saqlanadi                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| Baza (`pg_dump`, siqilgan; yozilgandan keyin o'qib tekshiriladi) | `docker/backups/db/santexgo-YYYYMMDD-HHMMSS.dump` (UTC) | `BACKUP_KEEP_DAYS` kun (standart 14)                             |
| Yuklangan fayllar (rasmlar, PDF)                                 | `docker/backups/uploads/`                               | Doim: faqat yangilari qo'shiladi, o'chirilgan fayllar ham qoladi |

- **Jadval** — `BACKUP_CRON`, cron formatida va **UTC** vaqtida. Toshkent vaqti = UTC + 5 soat:

  | Kerakli vaqt (Toshkent)        | `BACKUP_CRON`     |
  | ------------------------------ | ----------------- |
  | Har kuni 03:00 (standart)      | `"0 22 * * *"`    |
  | Har kuni 01:30                 | `"30 20 * * *"`   |
  | Kuniga 2 marta: 03:00 va 15:00 | `"0 10,22 * * *"` |

- **Papka** — `BACKUP_DIR` (standart `./backups`, ya'ni `docker/backups`; nisbiy yo'l `docker/` papkasiga nisbatan). Alohida diskka saqlash uchun absolyut yo'l bering, masalan `/mnt/backup/santexgo`.
- Sozlamani o'zgartirgandan keyin: `sh scripts/prod.sh start`.
- Backup xizmati ishga tushganda oxirgi 24 soatda zaxira bo'lmasa, darhol bittasini yaratadi. 26 soat davomida yangi zaxira bo'lmasa, `status` da `backup` — `unhealthy`.
- Zaxiralarda mijozlarning shaxsiy ma'lumotlari bor, shuning uchun baza fayllari `root` ga tegishli va faqat u o'qiy oladi — ko'chirish uchun `sudo` kerak.
- Redis zaxiralanmaydi — unda faqat kesh va vaqtinchalik hisoblagichlar.

### 7.2. Qo'lda zaxira va ro'yxat

```
sh scripts/prod.sh backup     # hozir zaxira yaratish
sh scripts/prod.sh backups    # baza zaxiralari ro'yxati
```

### 7.3. Serverdan tashqariga nusxa (qat'iy tavsiya etiladi)

Zaxira o'sha serverning o'zida tursa, server, disk yoki provayder bilan muammo bo'lganda zaxira ham yo'qoladi. Har kuni nusxani boshqa joyga ko'chiring. Baza fayllari `root` ga tegishli bo'lgani uchun vazifa `root` ning cron jadvalida ishlaydi. Server vaqt zonasi — `timedatectl` (VPS'larda odatda UTC); quyidagi misollarda `30 23 * * *` = 23:30 UTC = Toshkent vaqti bilan 04:30, ya'ni kunlik zaxiradan 1,5 soat keyin.

**A) Boshqa serverga (rsync, SSH orqali).**

1. `root` uchun alohida SSH kalit:

   ```
   sudo ssh-keygen -t ed25519 -N "" -f /root/.ssh/santexgo_backup
   sudo cat /root/.ssh/santexgo_backup.pub
   ```

2. Zaxira serverida (masalan, `backup@203.0.113.10`) shu ochiq kalitni `~/.ssh/authorized_keys` ga qo'shing va papka yarating: `mkdir -p ~/santexgo-backups`.
3. Birinchi ulanish (server kalitini tasdiqlash uchun, `yes`): `sudo ssh -i /root/.ssh/santexgo_backup backup@203.0.113.10 true`
4. `sudo crontab -e` va oxiriga bitta qator:

   ```
   30 23 * * * rsync -a -e "ssh -i /root/.ssh/santexgo_backup" /home/deploy/santexgo/docker/backups/ backup@203.0.113.10:santexgo-backups/ >> /var/log/santexgo-offsite.log 2>&1
   ```

   `--delete` ishlatilmaydi: serverda fayl o'chirilsa ham, nusxasi qoladi. Zaxira serveridagi eski fayllarni vaqti-vaqti bilan o'zingiz tozalang.

**B) S3-mos saqlash joyiga (rclone)** — Cloudflare R2, Backblaze B2, AWS S3 va boshqalar:

1. Provayderda **yopiq** (private) bucket va faqat shu bucket uchun kalit yarating.
2. `sudo apt install -y rclone`, keyin `sudo rclone config` → `n` (new remote) → nomi `offsite` → turi `s3` → provayderni tanlang va kalitlarni kiriting.
3. `sudo crontab -e` va qator:

   ```
   30 23 * * * rclone copy /home/deploy/santexgo/docker/backups offsite:santexgo-backups --log-file /var/log/santexgo-offsite.log
   ```

   `rclone copy` faqat yangi fayllarni qo'shadi, hech narsani o'chirmaydi. Saqlash muddatini bucket'ning "lifecycle" qoidasi bilan cheklash mumkin (masalan, 90 kun).

Ertasi kuni tekshiring: `sudo tail /var/log/santexgo-offsite.log` va zaxira joyida yangi fayllar paydo bo'lganini ko'ring. Zaxira joyiga kirish ma'lumotlarini va `docker/.env.production` nusxasini parol menejerida saqlang. Qonunchilik bo'yicha izoh — [2-bo'lim](#2-server-tanlash).

### 7.4. Bazani tiklash

```
sh scripts/prod.sh backups
sh scripts/prod.sh restore santexgo-20261008-220000.dump
```

Skript ogohlantiradi va davom etish uchun `HA` deb yozishni so'raydi (boshqa javob — bekor qilish). Keyin:

1. API, sayt va admin panel to'xtatiladi — tiklash tugaguncha sayt ochilmaydi.
2. Zaxira avval alohida vaqtinchalik bazaga yoziladi. Xato bo'lsa, joriy bazaga tegilmaydi.
3. Joriy baza o'chirilmaydi — `santexgo_old_<vaqt>` nomi bilan saqlab qo'yiladi, tiklangan baza uning o'rnini oladi.
4. Xizmatlar qayta ishga tushadi; zaxira eskiroq versiyadan bo'lsa, yetishmayotgan migratsiyalar avtomatik qo'llanadi.

Zaxira vaqtidan keyingi o'zgarishlar (yangi buyurtmalar, ro'yxatdan o'tganlar) saytdan yo'qoladi, lekin eski bazada saqlanib turadi. Hammasi joyida ekaniga ishonch hosil qilgach, eski bazani o'chirib disk joyini bo'shating (aniq nomni tiklash oxirida skript chiqaradi):

```
sh scripts/prod.sh psql -c '\l'
sh scripts/prod.sh psql -c 'DROP DATABASE "santexgo_old_20261008123000"'
```

Zaxira fayli boshqa joydan (masalan, zaxira serveridan) olingan bo'lsa, avval uni `docker/backups/db/` papkasiga ko'chiring (`sudo cp ...`) va `restore` ga fayl nomini bering.

### 7.5. Yuklangan fayllarni tiklash

`restore` faqat bazani tiklaydi. Rasmlar va PDF'lar (`STORAGE_DRIVER=local`) zaxiradan API konteyneriga nusxalanadi:

```
sh scripts/prod.sh compose cp -a docker/backups/uploads/. api:/app/apps/api/uploads/
```

- Mavjud fayllar ustidan yoziladi, boshqalari o'chirilmaydi. Qayta ishga tushirish shart emas.
- `-a` — fayl egasini saqlaydi (konteynerda `node` foydalanuvchisi, ID 1000). Fayllar boshqa joydan olib kelingan bo'lsa, avval: `sudo chown -R 1000:1000 docker/backups/uploads`.
- `BACKUP_DIR` boshqa papka bo'lsa, `docker/backups` o'rniga o'sha yo'lni yozing.

### 7.6. Yangi serverga ko'chish (server butunlay ishdan chiqqanda)

1. Yangi serverni 3–4-bo'limlar bo'yicha tayyorlang, DNS'ni yangi IP'ga o'zgartiring.
2. `docker/.env.production` ning saqlangan nusxasi bo'lsa — uni `~/santexgo/docker/` ga qo'ying (`chmod 600 docker/.env.production`); bo'lmasa, `init` va 5.2-qadam.
3. `sh scripts/prod.sh deploy`. `seed` va `admin` shart emas — ular zaxirada bor.
4. Zaxirani serverga qaytaring: baza faylini `docker/backups/db/` ga, fayllarni `docker/backups/uploads/` ga (`sudo rsync` yoki `sudo rclone copy` teskari yo'nalishda).
5. `sh scripts/prod.sh restore <fayl>` va 7.5-qadam.
6. Saytni tekshiring (5.7). `AUTH_SECRET` yangi bo'lsa, barcha foydalanuvchilar qayta kiradi.

### 7.7. Tiklashni sinab ko'ring

Zaxira faqat undan tiklash mumkin bo'lsa foydali. Oyiga bir marta, ishlayotgan saytga tegmasdan, zaxirani vaqtinchalik bazaga tiklab ko'ring (fayl nomini `backups` ro'yxatidan oling):

```
sh scripts/prod.sh compose exec -T backup sh -c '
  createdb santexgo_test &&
  pg_restore --no-owner --no-privileges --exit-on-error -d santexgo_test /backups/db/santexgo-20261008-220000.dump &&
  psql -d santexgo_test -c "SELECT count(*) AS mahsulotlar FROM products" -c "SELECT count(*) AS buyurtmalar FROM orders"
  dropdb santexgo_test'
```

Mahsulotlar va buyurtmalar soni chiqsa — zaxira yaroqli; vaqtinchalik baza oxirida o'chiriladi. Yiliga bir-ikki marta to'liq mashq qiling: alohida sinov serverida 7.6-bo'limni boshidan oxirigacha bajaring.

## 8. Kuzatish va loglar

### 8.1. Holat

```
sh scripts/prod.sh status
```

`STATUS` ustunida: `Up ... (healthy)` — yaxshi; `(health: starting)` — endigina ishga tushmoqda; `(unhealthy)` yoki `Restarting` — muammo ([10-bo'lim](#10-muammolar-va-yechimlar)). `migrate` ro'yxatda ko'rinmaydi — u ishini bajarib to'xtaydi.

| Xizmat         | Healthcheck nimani tekshiradi                                                       |
| -------------- | ----------------------------------------------------------------------------------- |
| `postgres`     | Baza ulanishlarni qabul qilyaptimi                                                  |
| `redis`        | Redis javob beryaptimi                                                              |
| `api`          | `/api/health`: baza ishlayaptimi (baza ishlamasa `503`; Redis ishlamasa `degraded`) |
| `web`, `admin` | Server javob beryaptimi                                                             |
| `backup`       | Oxirgi 26 soatda muvaffaqiyatli zaxira bormi                                        |
| `caddy`        | Healthcheck yo'q — `Up` bo'lsa yetarli                                              |

### 8.2. Loglar

```
sh scripts/prod.sh logs          # hamma xizmatlar: oxirgi 200 qator va yangilari
sh scripts/prod.sh logs api      # bitta xizmat: api, web, admin, caddy, postgres, redis, backup, migrate
```

Chiqish — **Ctrl + C** (xizmatlar to'xtamaydi). API va Caddy loglari JSON formatida. Kuzatmasdan, faqat oxirgi qatorlar yoki qidirish:

```
sh scripts/prod.sh compose logs --tail 100 api
sh scripts/prod.sh compose logs --since 1h api | grep -i error
```

### 8.3. Disk

```
df -h /
docker system df
sudo du -sh docker/backups/*
```

Build keshi vaqt o'tishi bilan bir necha GB ga o'sadi. Tozalash xavfsiz (faqat keyingi build sekinroq bo'ladi):

```
docker builder prune -f
```

Eski versiyalarni `deploy` o'zi tozalaydi (oxirgi 5 tasi qoladi).

> **Hech qachon** `sh scripts/prod.sh compose down -v` yoki `docker volume prune -a` bermang — baza, rasmlar va sertifikatlar o'chib ketadi. `docker system prune -a` esa rollback uchun saqlangan versiyalarni o'chiradi.

### 8.4. Tashqi monitoring

Server o'zi ishdan chiqsa, bu haqda xabar bera olmaydi. Tashqi uptime monitoring xizmatlaridan birida (masalan, UptimeRobot yoki Better Stack — bepul tariflari yetarli) monitor yarating:

- `https://santexgo.uz/api/health` — har 1–5 daqiqada, kutilgan javob HTTP `200` (baza ishlamasa `503` qaytadi).
- `https://admin.santexgo.uz/login` — admin panel.
- Email yoki Telegram orqali xabarnoma; SSL sertifikat muddati ogohlantirishi bo'lsa — uni ham yoqing.

### 8.5. Muntazam ishlar

| Qachon     | Nima qilish                                                                                                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Har hafta  | `status` — hammasi `healthy`; `backups` — yangi zaxiralar bor; `df -h /` — diskning kamida 20% i bo'sh                                                                                                                                                   |
| Har oy     | `sudo apt update && sudo apt upgrade -y` (Docker yangilansa, konteynerlar bir necha soniyaga qayta ishga tushadi); `/var/run/reboot-required` fayli bo'lsa — mijozlar kam paytda `sudo reboot`; `backup` + `git pull` + `deploy`; tiklashni sinash (7.7) |
| Har chorak | `docker builder prune -f`; serverdan tashqaridagi nusxani tekshirish; Eskiz balansi; admin akkauntlar ro'yxati                                                                                                                                           |

## 9. Xavfsizlik

- [ ] `docker/.env.production` faqat serverda: git'ga tushmaydi (`.gitignore`), Docker image'lariga kirmaydi, huquqlari `-rw-------` (`ls -l docker/.env.production`; kerak bo'lsa `chmod 600 docker/.env.production`). Hech kimga yubormang; nusxasini parol menejerida saqlang.
- [ ] Parollar va kalitlar — `init` yaratgan tasodifiy qiymatlar (`POSTGRES_PASSWORD`, `REDIS_PASSWORD` — 48 belgi, `AUTH_SECRET` — 64 belgi). Qo'lda oddiy parol qo'ymang.
- [ ] `AUTH_SECRET` ni faqat sizib chiqqan bo'lsa almashtiring (`openssl rand -hex 32`, keyin `sh scripts/prod.sh start`): barcha foydalanuvchilar, adminlar ham, tizimdan chiqadi va qayta kirishi kerak; yuborilgan SMS kodlar ishlamay qoladi.
- [ ] `POSTGRES_PASSWORD` ni faylda shunchaki o'zgartirmang — baza parolni faqat birinchi yaratilganda oladi va API ulana olmay qoladi. To'g'ri tartib: `sh scripts/prod.sh psql` → `\password santexgo` → yangi parol (faqat harf va raqam, masalan `openssl rand -hex 24`) → `\q` → shu parolni faylga yozing → `sh scripts/prod.sh start`.
- [ ] Admin parollari kamida 12 belgi va boshqa joyda ishlatilmagan; admin akkauntlar faqat kerakli odamlarda. Admin telefon raqami ishonchli bo'lsin — parolni tiklash SMS'i shu raqamga keladi.
- [ ] SSH faqat kalit bilan, `root` kirishi o'chiq (4.4).
- [ ] Tashqariga faqat 22, 80 va 443 ochiq (`sudo ufw status`); `postgres`/`redis` ga `ports:` qo'shilmagan (4.5).
- [ ] Admin API faqat admin domeni orqali — tekshirish: `curl -s -o /dev/null -w '%{http_code}\n' https://santexgo.uz/api/v1/admin/orders` → `404`.
- [ ] Xavfsizlik sarlavhalari avtomatik: HSTS (1 yil, subdomenlar bilan — `santexgo.uz` ning barcha subdomenlari HTTPS'da ishlashi kerak), har so'rovda yangi nonce bilan qat'iy Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`. Tekshirish: `curl -sI https://santexgo.uz | grep -iE 'strict-transport|content-security'`. API hujjati (Swagger) production'da o'chiq.
- [ ] Server va Docker yangilanib turadi (4.6 va oylik `apt upgrade`); image'lar — oylik `deploy` (u har safar Node.js, PostgreSQL, Redis va Caddy'ning yangilangan bazaviy image'larini yuklaydi).
- [ ] PostgreSQL'ning asosiy versiyasini (`postgres:16-alpine`) o'zingiz o'zgartirmang — yangi asosiy versiyaga o'tish zaxira va tiklashni talab qiladi.
- [ ] Eskiz: `SMS_DAILY_LIMIT` kunlik limiti o'rnatilgan; Eskiz kabinetida balans tugashi haqida ogohlantirish yoqilgan; kabinet paroli kuchli.
- [ ] `docker` guruhi — amalda root huquqi; serverga faqat ishonchli odamlar kira oladi.
- [ ] Zaxira serverdan tashqarida ham bor va tiklash sinab ko'rilgan (7-bo'lim).

## 10. Muammolar va yechimlar

**Sertifikat olinmadi** (brauzerda "xavfsiz emas" yoki `ERR_SSL_...`):

1. `nslookup santexgo.uz` (va `www.`, `admin.`) — server IP'sini ko'rsatyaptimi?
2. Portlar ochiqmi: `sudo ufw status` va provayder panelidagi firewall. Kompyuteringizdan `curl -I http://santexgo.uz` → `308 Permanent Redirect` va `Server: Caddy` chiqishi kerak; javob kelmasa — 80-port yopiq.
3. `sh scripts/prod.sh logs caddy` — `challenge`, `obtain`, `error` so'zlari bor qatorlar sababni aytadi.
4. Tuzatgandan keyin Caddy o'zi qayta urinadi; tezlashtirish: `sh scripts/prod.sh restart caddy`. Ketma-ket ko'p qayta ishga tushirmang — Let's Encrypt urinishlar sonini cheklaydi.

**Xizmat `unhealthy` yoki `deploy` "unhealthy" deb to'xtadi:** `sh scripts/prod.sh status`, keyin muammoli xizmat logi (`sh scripts/prod.sh logs <xizmat>`):

| Xizmat         | Ko'p uchraydigan sabab                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `api`          | `Muhit o'zgaruvchilari noto'g'ri` — `.env.production` dagi xato (log qaysi o'zgaruvchi ekanini aytadi); baza ishlamayapti |
| `migrate`      | Migratsiya xatosi — API ham ishga tushmaydi. Logni saqlab, dasturchiga yuboring; kerak bo'lsa `rollback`                  |
| `web`, `admin` | Avval `api` sog'lom bo'lishi kerak — `api` ni tuzating                                                                    |
| `backup`       | 26 soat zaxira yo'q: disk to'lgan yoki baza xatosi; qo'lda `sh scripts/prod.sh backup` xatoni ko'rsatadi                  |
| `postgres`     | Ko'pincha disk to'lgan                                                                                                    |

Tuzatgandan keyin: `sh scripts/prod.sh deploy` (yoki faqat sozlama o'zgargan bo'lsa — `start`).

**80/443-port band** (`port is already allocated` yoki `address already in use`): serverda boshqa veb-server ishlayapti.

```
sudo ss -tlnp | grep -E ':(80|443) '
sudo systemctl disable --now apache2     # Apache bo'lsa
sudo systemctl disable --now nginx       # nginx bo'lsa
sh scripts/prod.sh start
```

**Disk to'ldi** (`no space left on device`): `df -h /` va `docker system df` bilan nima ko'p joy egallaganini toping; `docker builder prune -f`; `sudo du -sh docker/backups/*` — zaxiralar katta bo'lsa `BACKUP_KEEP_DAYS` ni kamaytiring yoki `BACKUP_DIR` ni alohida diskka ko'chiring; tizim jurnallari: `sudo journalctl --vacuum-size=200M`. Yetmasa — provayderda diskni kengaytiring. 8.3-bo'limdagi taqiqlangan buyruqlarni bermang.

**Build paytida xotira yetmadi** (`Killed`, `exit code: 137`, `ResourceExhausted`, `JavaScript heap out of memory` yoki server qotib qoladi): swap qo'shing (4.7) va `deploy` ni qayta bering. Bu vaqtda sayt eski versiyada ishlashda davom etadi.

**Admin parolini unutdingiz:**

1. Saytda **Kirish → Parolni unutdingizmi?** — SMS kod admin telefoniga keladi (admin akkauntlar uchun ham ishlaydi). Yangi parol bilan admin panelga kiring.
2. Yoki boshqa telefon raqami bilan yangi admin yarating: `sh scripts/prod.sh admin`. Diqqat: mavjud raqam uchun bu buyruq parolni o'zgartirmaydi.

| Xato yoki holat                                                                | Yechim                                                                                                      |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `docker/.env.production yo'q. Avval: sh scripts/prod.sh init`                  | 5.1-qadam                                                                                                   |
| `docker/.env.production allaqachon mavjud — ustiga yozilmaydi`                 | `init` bajarilgan — faylni `nano` bilan tahrirlang                                                          |
| `ESKIZ_EMAIL va ESKIZ_PASSWORD berilmagan`                                     | 5.2-qadam, Eskiz                                                                                            |
| `POSTGRES_PASSWORD va REDIS_PASSWORD faqat harf va raqamlardan iborat bo'lsin` | Parolni `openssl rand -hex 24` bilan yarating (bazadagi parolni almashtirish — 9-bo'lim)                    |
| `santexgo-api:... topilmadi` (`rollback`)                                      | `sh scripts/prod.sh versions` dagi versiyalardan birini bering                                              |
| `permission denied ... docker.sock`                                            | `sudo usermod -aG docker $USER`, serverdan chiqib qayta kiring                                              |
| `toomanyrequests` (image yuklashda)                                            | Docker Hub'ning anonim yuklash limiti: bir soat kuting yoki bepul Docker Hub akkaunti bilan `docker login`  |
| Admin panel: `Bu akkauntda admin panelga kirish huquqi yo‘q`                   | `sh scripts/prod.sh admin` — shu raqamga admin huquqi beriladi                                              |
| SMS kelmayapti                                                                 | `sh scripts/prod.sh compose logs --tail 300 api \| grep -iE 'eskiz\|sms'` — pastga qarang                   |
| Rasmlar ko'rinmayapti (S3)                                                     | `MEDIA_PUBLIC_URL`, `MEDIA_ORIGIN` va bucket ochiqligini tekshiring, keyin `sh scripts/prod.sh start`       |
| `deploy` dan keyin bir daqiqa `502 Bad Gateway`                                | Normal holat — xizmatlar qayta ishga tushmoqda; uzoq davom etsa `status`                                    |
| Boshqa xato                                                                    | Xato matni va `sh scripts/prod.sh status` natijasini to'liq nusxalab, dasturchiga (yoki Claude'ga) yuboring |

SMS loglarida: `Eskiz'ga kirib bo'lmadi` — `ESKIZ_EMAIL`/`ESKIZ_PASSWORD` xato (tuzatib, `sh scripts/prod.sh start`); `SMS yuborilmadi ... HTTP ...` — shablon tasdiqlanmagan, balans tugagan yoki `SMS_SENDER` noto'g'ri; `Kunlik SMS limiti (...) tugadi` — `SMS_DAILY_LIMIT` ga yetildi (ertasi kuni tiklanadi yoki limitni oshiring).

## 11. Buyruqlar ro'yxati

Hammasi loyiha papkasida: `sh scripts/prod.sh <buyruq>`.

| Buyruq                               | Vazifasi                                                                    |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `init [domen] [admin-domen] [email]` | `docker/.env.production` ni yaratish (parollar va kalitlar avtomatik)       |
| `deploy`                             | Build, migratsiyalar va ishga tushirish — birinchi o'rnatish va yangilash   |
| `seed`                               | Ma'lumotnomalar: kategoriyalar, materiallar, ombor (qayta berish xavfsiz)   |
| `admin`                              | Admin yaratish yoki mavjud foydalanuvchiga admin huquqi berish              |
| `versions`                           | Rollback uchun saqlangan versiyalar                                         |
| `rollback <versiya>`                 | Oldingi versiyaga qaytish (baza migratsiyalari qaytarilmaydi)               |
| `status`                             | Xizmatlar holati                                                            |
| `logs [xizmat]`                      | Loglarni kuzatish (chiqish — Ctrl + C)                                      |
| `stop`                               | Hamma xizmatlarni to'xtatish — sayt yopiladi                                |
| `start`                              | Ishga tushirish; `.env.production` dagi o'zgarishlarni qo'llash             |
| `restart [xizmat]`                   | Qayta ishga tushirish (yangi sozlamalarni o'qimaydi)                        |
| `backup`                             | Hozir zaxira nusxa yaratish                                                 |
| `backups`                            | Baza zaxiralari ro'yxati                                                    |
| `restore <fayl>`                     | Bazani zaxiradan tiklash (`HA` tasdig'i bilan; joriy baza saqlab qo'yiladi) |
| `psql [argumentlar]`                 | Baza konsoli (chiqish — `\q`)                                               |
| `compose <argumentlar>`              | Shu loyiha uchun istalgan `docker compose` buyrug'i                         |
