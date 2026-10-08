#!/bin/sh
# Bazani zaxira nusxadan tiklash (sh scripts/prod.sh restore <fayl> orqali, API to'xtatilgan holda).
#
# Xavfsiz tartib: zaxira avval alohida bazaga yoziladi. Faqat u muvaffaqiyatli tiklansa,
# joriy baza "<nom>_old_<vaqt>" deb qayta nomlanadi (o'chirilmaydi) va tiklangani uning o'rnini oladi.
set -eu

FILE=${1:?Ishlatish: restore.sh <zaxira fayli>}
[ -f "$FILE" ] || FILE="/backups/db/$FILE"
[ -f "$FILE" ] || { echo "Fayl topilmadi: $FILE" >&2; exit 1; }

DB=$PGDATABASE
STAMP=$(date -u +%Y%m%d%H%M%S)
TMP_DB="${DB}_restore_${STAMP}"
OLD_DB="${DB}_old_${STAMP}"
psql_admin() { psql --no-psqlrc -v ON_ERROR_STOP=1 --dbname postgres "$@"; }

pg_restore --list "$FILE" > /dev/null
echo "1/3 Zaxira vaqtinchalik bazaga yozilmoqda: $TMP_DB"
psql_admin -c "CREATE DATABASE \"$TMP_DB\""
if ! pg_restore --no-owner --no-privileges --single-transaction --exit-on-error \
  --dbname "$TMP_DB" "$FILE"; then
  psql_admin -c "DROP DATABASE IF EXISTS \"$TMP_DB\""
  echo "Tiklash muvaffaqiyatsiz — joriy bazaga tegilmadi" >&2
  exit 1
fi

echo "2/3 Joriy baza saqlab qo'yilmoqda: $OLD_DB"
psql_admin -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB' AND pid <> pg_backend_pid()" > /dev/null
psql_admin -c "ALTER DATABASE \"$DB\" RENAME TO \"$OLD_DB\""

echo "3/3 Tiklangan baza ishga tushirilmoqda: $DB"
psql_admin -c "ALTER DATABASE \"$TMP_DB\" RENAME TO \"$DB\""

echo "Tayyor: $(basename "$FILE") tiklandi. Eski baza: $OLD_DB"
echo "Hammasi joyida bo'lsa, uni o'chirish: sh scripts/prod.sh psql -c 'DROP DATABASE \"$OLD_DB\"'"
