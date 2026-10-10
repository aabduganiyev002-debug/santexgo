#!/bin/sh
# Zaxira nusxa:
#   /backups/db/santexgo-YYYYMMDD-HHMMSS.dump — baza (pg_dump custom format, siqilgan)
#   /backups/uploads/                          — yuklangan rasmlar va PDF'lar (faqat yangilari qo'shiladi)
# Qo'lda ishga tushirish: sh scripts/prod.sh backup
set -eu

KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
# Muddatidan qat'i nazar har doim saqlanadigan eng yangi zaxiralar soni (zaxira bir necha hafta
# muvaffaqiyatsiz bo'lsa ham, oxirgi yaxshi nusxalar o'chib ketmasin)
KEEP_MIN=3
STAMP=$(date -u +%Y%m%d-%H%M%S)
FILE="/backups/db/santexgo-$STAMP.dump"
umask 077
mkdir -p /backups/db /backups/uploads

# Eski zaxiralar va yarim qolgan fayllar avval tozalanadi: disk to'lib qolgan bo'lsa ham joy bo'shaydi
find /backups/db -name 'santexgo-*.dump' -mtime +"$KEEP_DAYS" | sort | while read -r old; do
  if ! find /backups/db -name 'santexgo-*.dump' | sort -r | head -n "$KEEP_MIN" | grep -qxF "$old"; then
    rm -f "$old"
  fi
done
find /backups/db -name '*.partial' -mmin +720 -delete

# Shu urinishning yarim qolgan fayli xatoda o'chiriladi
trap 'rm -f "$FILE.partial"' EXIT

# Avval vaqtinchalik nomga yoziladi: yarim qolgan fayl hech qachon tayyor zaxira bo'lib ko'rinmaydi
pg_dump --format=custom --compress=6 --no-owner --no-privileges --file "$FILE.partial"
# Fayl o'qiladigan va to'liq ekanini tekshirish
pg_restore --list "$FILE.partial" > /dev/null
mv "$FILE.partial" "$FILE"
echo "$(date -u '+%F %T') Baza zaxiralandi: $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"

# Fayl nomlari tasodifiy va o'zgarmaydi — faqat yangilari nusxalanadi. O'chirilgan fayllar
# zaxirada qoladi (tasodifan o'chirilgan mahsulot rasmlarini ham tiklash mumkin).
if [ -d /uploads ]; then
  cp -a -u /uploads/. /backups/uploads/
  echo "$(date -u '+%F %T') Fayllar nusxalandi: $(du -sh /backups/uploads | cut -f1)"
fi
