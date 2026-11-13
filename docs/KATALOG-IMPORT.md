# Katalogni yuklash (import)

Admin panelda: **Mahsulotlar → Katalogni yuklash**. Bitta ZIP fayl bilan yuzlab mahsulot narxi,
qoldig'i va rasmlari bilan qo'shiladi; keyingi narx ro'yxati xuddi shu yo'l bilan yangilanadi.

## Qoidalar

- Mahsulotlar **SKU** bo'yicha topiladi. Yangisi yaratiladi — boshlang'ich qoldig'i (`stock`), o'lcham
  guruhi va rasmi bilan. Saytda bor mahsulotning faqat **nomi, narxi, o'lchov birligi, qisqa tavsifi va
  xususiyatlari** yangilanadi: qoldig'i, kategoriyasi va rasmlariga tegilmaydi.
- Kategoriya, brend va material **slug** bo'yicha: yo'g'i yaratiladi, borini o'zgartirmaydi. Shu nomli
  brend yoki material boshqa slug bilan bo'lsa — o'shanisi ishlatiladi.
- Rasm faqat rasmi yo'q mahsulotga qo'shiladi (`images` dagi birinchisi). Bitta rasmli bir nechta
  mahsulot (masalan, bir modelning o'lchamlari) — fayl serverda bir marta saqlanadi.
- Faylni qayta yuklash xavfsiz: hech narsa ikki marta qo'shilmaydi. Xato qator (masalan, kategoriyasi
  topilmagan) boshqalariga xalaqit bermaydi — natijada SKU va sababi bilan ko'rsatiladi.

## Namunaviy ma'lumotlar

Windows paketi va sinov serveri dastur bilan birga namunaviy (sinov) mahsulot va chegirmalarni yozadi.
Haqiqiy katalog yuklangach, **Katalogni yuklash** sahifasidagi **«Namunaviy ma'lumotlarni o'chirish»**
tugmasini bosing: aks holda namunaviy chegirmalar (masalan, butun «Kanalizatsiya» kategoriyasiga −5%)
haqiqiy mahsulotlarga ham tushadi. Tugma faqat seed yozgan namunaviy mahsulotlar, chegirmalar, ularning
guruhlari va Vero brendini o'chiradi (ro'yxat: `packages/shared/src/sample-data.ts`); buyurtmalarda bor
mahsulot arxivlanadi.

## Fayl tuzilishi

```
katalog.zip
├── katalog.json
└── images/
    ├── truba.png
    └── radiator.jpg
```

`katalog.json` (to'liq sxema: `packages/shared/src/schemas/catalog-import.ts`):

```json
{
  "format": "santexgo-katalog",
  "version": 1,
  "title": "Plastherm narxlari",
  "categories": [
    { "slug": "trubalar", "name": "Trubalar", "parent": null, "attributes": ["diameter_mm", "pn"] },
    { "slug": "radiatorlar", "name": "Radiatorlar", "parent": "isitish" }
  ],
  "brands": [{ "slug": "plastherm", "name": "Plastherm", "country": "O‘zbekiston" }],
  "materials": [{ "slug": "ppr", "name": "PPR" }],
  "products": [
    {
      "sku": "PN102",
      "name": "ТРУБА ППР ХВС PN-10 Ø 25",
      "category": "trubalar",
      "brand": "plastherm",
      "material": "ppr",
      "group": "ТРУБА ППР ХВС PN-10",
      "groupAttribute": "diameter_mm",
      "unit": "METER",
      "price": 8540,
      "stock": 100,
      "shortDescription": "Упаковка: 100 м",
      "attributes": { "diameter_mm": 25, "pn": "PN10" },
      "images": ["images/truba.png"]
    }
  ]
}
```

| Maydon       | Talab                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| `sku`        | Lotin harflari, raqamlar, `.` `_` `-` `/` (2–64 belgi); faylda takrorlanmaydi                                 |
| `price`      | So'mda, butun son, 0 dan katta                                                                                |
| `unit`       | `PIECE`, `METER`, `PACK`, `SET`, `KG` (bo'lmasa — `PIECE`)                                                    |
| `attributes` | Faqat bazadagi xususiyat kalitlari (`diameter_mm`, `pn`, `thread_size` ...); noma'lumi e'tiborsiz qoldiriladi |
| `group`      | Bir modelning o'lchamlari — saytda o'lcham tanlash chiqadi (`groupAttribute` bo'yicha)                        |
| `images`     | ZIP ichidagi yo'l; rasm 10 MB gacha (JPEG, PNG, WebP)                                                         |

API: `POST /api/v1/admin/catalog-import/products` (100 tagacha mahsulot) va
`POST /api/v1/admin/catalog-import/image` (multipart: `file` + `skus` vergul bilan).
