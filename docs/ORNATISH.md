# SantexGo'ni kompyuterda ishga tushirish

Birinchi o'rnatish taxminan 30–40 daqiqa oladi (ko'p qismi dasturlarni yuklab olish). Keyin har kuni ishga tushirish uchun bitta buyruq yetadi.

Kompyuterga talablar: Windows 10/11 (64-bit) yoki macOS, kamida 8 GB operativ xotira, 10 GB bo'sh joy, internet.

## Eng oson yo'l: tayyor paket (Windows)

Hech narsa o'rnatish shart emas — Node.js, baza (PostgreSQL) va tayyor sayt bitta ZIP faylda.

1. **[SantexGo-Windows.zip](https://github.com/aabduganiyev002-debug/santexgo/releases/latest/download/SantexGo-Windows.zip)** ni yuklab oling.
2. ZIP'ni o'ng tugma bilan bosing — **Extract All** (Hammasini chiqarish), masalan `C:\SantexGo` papkasiga (yo'lda lotin bo'lmagan harflar bo'lmasin).
3. Papkadagi **`SantexGo.bat`** ni ikki marta bosing. Windows ogohlantirsa — **Run** (yoki **More info** → **Run anyway**).

Birinchi marta 1–2 daqiqa: baza yaratiladi, katalog va namunaviy mahsulotlar yoziladi. Keyin brauzerda sayt (http://localhost:3000) va admin panel (http://localhost:3001) ochiladi. Admin telefon raqami va paroli papkadagi `ADMIN-KIRISH.txt` faylida. O'z raqamingiz va parolingizni qo'yish uchun saytga shu raqam va parol bilan kiring, keyin "Profil va xavfsizlik" (http://localhost:3000/account/profile): yangi raqamga SMS kod qora oynada chiqadi.

- To'xtatish: qora oynani yoping (yoki `SantexGo-toxtatish.bat`). Keyingi safar yana `SantexGo.bat` — qo'shgan ma'lumotlaringiz `data` papkasida saqlanadi.
- SMS kodlar (ro'yxatdan o'tish) haqiqiy SMS bo'lib ketmaydi — qora oynada ko'rsatiladi.
- Yangi versiyaga o'tish: yangi ZIP'ni oching va eski papkadagi `data` papkasini yangi papkaga ko'chiring.
- Bu nusxa faqat shu kompyuterda ishlaydi; internetdagi sayt uchun — [DEPLOY.md](DEPLOY.md) ("Tezkor o'rnatish — bitta buyruq").

## Kod bilan ishlash: ikki marta bosish (Windows)

Kodni o'zgartirmoqchi bo'lsangiz (dasturchilar uchun) — kod va dasturlar bilan:

1. 1-qadamdagi dasturlarni o'rnating va 2-qadamdagidek kodni yuklab oling.
2. Loyiha papkasida (masalan `Documents\santexgo`) **`SantexGo-ishga-tushirish.bat`** faylini ikki marta bosing.

Terminal kerak emas — fayl 3–6-qadamlarni o'zi bajaradi: Node.js'ni tekshiradi, pnpm'ni o'rnatadi, Docker Desktop'ni ochadi, `pnpm setup:local` ni bajaradi, saytni alohida server oynasida ishga tushiradi va brauzerda sayt (http://localhost:3000) hamda admin panelni (http://localhost:3001) ochadi.

- Birinchi marta 10–15 daqiqa ketadi. Oxirida admin telefon raqami va paroli chiqadi — yozib oling (ular `apps\api\.env` faylida ham saqlanadi).
- Server oynasini yopmang — sayt shu oyna ochiq turganda ishlaydi. SMS kodlar ham shu oynada chiqadi.
- Windows Firewall Node.js uchun ruxsat so'rasa, **Cancel** ni bosish mumkin — sayt shu kompyuterda baribir ochiladi.
- To'xtatish: **`SantexGo-toxtatish.bat`** ni ikki marta bosing (ma'lumotlar o'chmaydi).
- Har kuni shu faylni bosing. Kod yangilangandan keyin (GitHub Desktop'da **Pull origin**): avval `SantexGo-toxtatish.bat`, keyin `SantexGo-ishga-tushirish.bat` — yangilanishlar o'zi qo'llanadi.
- Xato chiqsa, oyna yopilmaydi: xato matnini o'qing yoki to'liq nusxalab Claude'ga yuboring. Qo'lda ishga tushirish quyidagi 3–6-qadamlarda.

## 1. Kerakli dasturlarni o'rnatish (bir marta)

| Dastur                    | Nima uchun                              | Qayerdan                                       |
| ------------------------- | --------------------------------------- | ---------------------------------------------- |
| GitHub Desktop            | Kodni yuklab olish va yangilash         | https://desktop.github.com                     |
| Node.js 24 LTS            | Kodni ishga tushirish                   | https://nodejs.org (chapdagi "LTS" tugmasi)    |
| Docker Desktop            | Baza (PostgreSQL) va boshqa xizmatlar   | https://www.docker.com/products/docker-desktop |
| VS Code (tavsiya etiladi) | Kodni ko'rish va terminal bilan ishlash | https://code.visualstudio.com                  |

Har birini oddiy dastur kabi o'rnating — barcha savollarda standart variantni qoldirib, "Next" bosing.

**Windows'da Docker Desktop:** o'rnatish paytida WSL 2 yoqiladi va kompyuterni qayta ishga tushirish so'ralishi mumkin. "Virtualization" haqida xato chiqsa, BIOS sozlamalarida virtualizatsiyani (Intel VT-x yoki AMD-V) yoqish kerak.

**Mac'da Docker Desktop:** protsessoringizga mos versiyani tanlang — Apple Silicon (M1/M2/M3/M4) yoki Intel.

Docker Desktop shaxsiy foydalanish va kichik biznes (250 dan kam xodim va yillik daromad 10 mln dollardan kam) uchun bepul.

## 2. Kodni yuklab olish

1. GitHub Desktop'ni oching va **Sign in to GitHub.com** orqali `aabduganiyev002-debug` akkauntingiz bilan kiring.
2. **File → Clone repository** ni tanlang, ro'yxatdan `santexgo` ni belgilang.
3. **Local path** da papkani tanlang (masalan `Documents\santexgo`) va **Clone** ni bosing.

## 3. Terminalni ochish

GitHub Desktop'da **Repository → Open in Command Prompt** (Windows) yoki **Open in Terminal** (Mac). Terminal to'g'ridan-to'g'ri loyiha papkasida ochiladi.

Yoki VS Code orqali: **Repository → Open in Visual Studio Code**, keyin VS Code menyusida **Terminal → New Terminal**.

> Windows PowerShell'da `running scripts is disabled on this system` xatosi chiqsa, bir marta shu buyruqni bering va `Y` ni bosing:
>
> ```
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

## 4. pnpm o'rnatish (bir marta)

Windows:

```
npm install -g pnpm@10.28.0
```

Mac (kompyuter parolingiz so'raladi):

```
sudo npm install -g pnpm@10.28.0
```

Tekshirish: `pnpm --version` buyrug'i `10.28.0` chiqarishi kerak. "pnpm topilmadi" desa, terminalni yopib, qayta oching.

## 5. Birinchi ishga tushirish

1. **Docker Desktop**'ni oching va u to'liq ishga tushishini kuting (pastki chap burchakda yashil "Engine running").
2. Terminalda:

   ```
   pnpm setup:local
   ```

Buyruq hamma narsani o'zi qiladi: parollar bilan sozlama fayllarini yaratadi, bog'liqliklarni o'rnatadi, bazani ishga tushiradi, jadvallarni yaratadi va namunaviy mahsulotlarni yozadi. Birinchi marta 5–10 daqiqa ketadi.

Oxirida **"✔ Hammasi tayyor!"** va admin akkaunt paroli chiqadi. Parol `apps/api/.env` faylida ham saqlanadi.

## 6. Har kuni ishlatish

1. Docker Desktop ochiq bo'lsin.
2. Terminalda: `pnpm dev`
3. Brauzerda oching: **http://localhost:3000** — sayt; **http://localhost:3001** — admin panel (telefon va parol — `pnpm setup:local` oxirida chiqqan admin akkaunt); http://localhost:4000/api/docs — API hujjati.
4. To'xtatish: terminalda **Ctrl + C**.

**SMS kodlar (ro'yxatdan o'tish, parolni tiklash):** kompyuterda haqiqiy SMS yuborilmaydi — kod `pnpm dev` ishlayotgan terminalda chiqadi, masalan: `📱 +998901234567: SantexGo: ro'yxatdan o'tish kodi 482913`.

**Bazani ko'rish:** yangi terminalda `pnpm db:studio` — brauzerda http://localhost:5555 ochiladi. U yerda mahsulotlar, brendlar, narxlar va qoldiqlarni jadval ko'rinishida ko'rasiz va tahrirlay olasiz.

## 7. Yangi bosqich chiqqanda (yangilash)

1. GitHub Desktop'da **Fetch origin**, keyin **Pull origin** ni bosing.
2. Terminalda: `pnpm setup:local` — yangi bog'liqliklar o'rnatiladi, bazaga yangi o'zgarishlar qo'llanadi. Mavjud ma'lumotlaringiz o'chmaydi.
3. `pnpm dev`

## Muammolar va yechimlar

| Xato                                             | Yechim                                                                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Docker ishlamayapti`                            | Docker Desktop'ni oching, "Engine running" chiqquncha kuting va buyruqni qayta bering                                                                     |
| `'pnpm' is not recognized` yoki `pnpm topilmadi` | 4-qadamni bajaring, keyin terminalni yopib qayta oching                                                                                                   |
| `running scripts is disabled on this system`     | 3-qadamdagi `Set-ExecutionPolicy` buyrug'i                                                                                                                |
| `port is already allocated` (5432)               | Kompyuterda boshqa PostgreSQL ishlayapti: `.env` da `POSTGRES_PORT=5433` qiling va `apps/api/.env` dagi `DATABASE_URL` portini ham `5433` ga o'zgartiring |
| `PostgreSQL bazasiga ulanib bo'lmadi`            | Docker Desktop ochiqmi? Keyin `pnpm infra:up`                                                                                                             |
| `Bazaga kirish paroli noto'g'ri`                 | `pnpm infra:reset`, keyin `pnpm setup:local` (lokal sinov ma'lumotlari o'chadi va qayta yoziladi)                                                         |
| WSL yoki Virtualization xatosi (Windows)         | Administrator sifatida PowerShell'da `wsl --update`; BIOS'da virtualizatsiyani yoqing                                                                     |
| Boshqa xato                                      | Xato matnini to'liq nusxalab, Claude'ga yuboring                                                                                                          |

## Muhim

- `.env` fayllarida parollar bor. Ular GitHub'ga yuklanmaydi (`.gitignore`) — hech kimga yubormang.
- Kompyuterdagi baza faqat sinov uchun. Real saytning ma'lumotlari serverda bo'ladi — serverga joylash: [DEPLOY.md](DEPLOY.md).
- Foydali buyruqlar: `pnpm infra:down` — Docker xizmatlarini to'xtatadi; `pnpm infra:up` — qayta yoqadi.
