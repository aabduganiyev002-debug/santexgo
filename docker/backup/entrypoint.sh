#!/bin/sh
# Jadval (BACKUP_CRON, UTC) bo'yicha backup.sh ni ishga tushiradi. Ishga tushganda oxirgi
# 24 soatda zaxira bo'lmasa — darhol bittasini yaratadi (yangi server, uzoq to'xtab qolish).
set -eu

: "${BACKUP_CRON:=0 22 * * *}"
mkdir -p /backups/db /backups/uploads

# cron vazifalari konteyner muhitini ko'rmaydi: kerakli o'zgaruvchilar faylga yoziladi (faqat root o'qiydi)
umask 077
: > /run/backup.env
for name in PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE BACKUP_KEEP_DAYS; do
  value=
  eval "value=\${$name:-}"
  escaped=$(printf '%s' "$value" | sed "s/'/'\\\\''/g")
  printf "export %s='%s'\n" "$name" "$escaped" >> /run/backup.env
done

# Natija "docker logs" da ko'rinishi uchun konteyner stdout'iga yoziladi
printf '%s . /run/backup.env && /usr/local/bin/backup.sh > /proc/1/fd/1 2>&1\n' "$BACKUP_CRON" \
  > /etc/crontabs/root

if ! find /backups/db -name 'santexgo-*.dump' -mmin -1440 | grep -q .; then
  echo "Oxirgi 24 soatda zaxira yo'q — hozir yaratiladi"
  /usr/local/bin/backup.sh || echo "Zaxira yaratilmadi — keyingi urinish jadval bo'yicha" >&2
fi

echo "Backup jadvali (UTC): $BACKUP_CRON; saqlash muddati: ${BACKUP_KEEP_DAYS:-14} kun"
exec crond -f -d 8
