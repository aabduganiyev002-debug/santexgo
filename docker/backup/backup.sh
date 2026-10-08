#!/bin/sh
# Zaxira nusxa:
#   /backups/db/santexgo-YYYYMMDD-HHMMSS.dump — baza (pg_dump custom format, siqilgan)
#   /backups/uploads/                          — yuklangan rasmlar va PDF'lar (faqat yangilari qo'shiladi)
# Qo'lda ishga tushirish: sh scripts/prod.sh backup
set -eu

KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
STAMP=$(date -u +%Y%m%d-%H%M%S)
FILE="/backups/db/santexgo-$STAMP.dump"
umask 077
mkdir -p /backups/db /backups/uploads

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

# Eski zaxiralar va yarim qolgan fayllar
find /backups/db -name 'santexgo-*.dump' -mtime +"$KEEP_DAYS" -delete
find /backups/db -name '*.partial' -mmin +720 -delete
