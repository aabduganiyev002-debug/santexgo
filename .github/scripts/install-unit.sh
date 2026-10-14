#!/bin/sh
# scripts/install.sh funksiyalari: domensiz bepul manzil (<IP>.sslip.io), o'z domeniga o'tish va
# Eskiz'siz (SMS keyin ulanadi) rejim. Tarmoqsiz va root'siz: tashqi IP aniqlash soxtalashtiriladi.
#   sh .github/scripts/install-unit.sh
set -eu

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# shellcheck source-path=SCRIPTDIR source=../../scripts/install.sh
SANTEXGO_INSTALL_SOURCE_ONLY=1 . "$ROOT/scripts/install.sh"

# Soxta tashqi IP va baza holati (Docker'ga murojaat qilinmaydi)
SERVER_IP=203.0.113.7
public_ipv4() {
  [ -n "$SERVER_IP" ] || return 1
  printf '%s\n' "$SERVER_IP"
}
admin_state() { echo yes; }

env_file=$WORK/.env.production
INTERACTIVE=0

check() {
  if [ "$2" != "$3" ]; then
    printf '✖ %s: "%s" (kutilgan: "%s")\n' "$1" "$2" "$3" >&2
    exit 1
  fi
  printf '✔ %s\n' "$1"
}

domains() {
  site=$1
  admin_domain=${2:-}
  write_keys=
  collect_domains > "$WORK/out"
}

# ── Domenlar ──

rm -f "$env_file"
domains ''
check "Domen berilmagan — bepul manzil" "$site" 203-0-113-7.sslip.io
check "Bepul manzil: admin panel" "$admin_domain" admin.203-0-113-7.sslip.io
check "Bepul manzil: faylga yoziladi" "$write_keys" " SITE_DOMAIN ADMIN_DOMAIN"

printf 'SITE_DOMAIN=203-0-113-7.sslip.io\nADMIN_DOMAIN=admin.203-0-113-7.sslip.io\n' > "$env_file"
domains ''
check "Qayta ishga tushirish: bepul manzil saqlanadi" "$site" 203-0-113-7.sslip.io
check "Qayta ishga tushirish: hech narsa yozilmaydi" "$write_keys" ""

SERVER_IP=198.51.100.20
domains ''
check "Server IP o'zgargan — yangi bepul manzil" "$site" 198-51-100-20.sslip.io
check "Yangi bepul manzil: admin panel" "$admin_domain" admin.198-51-100-20.sslip.io
grep -q "Server IP manzili o'zgargan" "$WORK/out"
check "Yangi bepul manzil: faylga yoziladi" "$write_keys" " SITE_DOMAIN ADMIN_DOMAIN"

SERVER_IP=203.0.113.7
domains 'https://WWW.SantexGo.uz/'
check "Bepul manzildan o'z domeniga o'tish" "$site" santexgo.uz
check "O'z domeni: admin panel" "$admin_domain" admin.santexgo.uz
check "O'z domeni: faylga yoziladi" "$write_keys" " SITE_DOMAIN ADMIN_DOMAIN"

domains santexgo.uz panel.santexgo.uz
check "O'z domeni: berilgan admin domeni" "$admin_domain" panel.santexgo.uz

printf 'SITE_DOMAIN=santexgo.uz\nADMIN_DOMAIN=admin.santexgo.uz\n' > "$env_file"
domains boshqa.uz
check "Faylda o'z domeni — o'zgarmaydi" "$site" santexgo.uz
check "Faylda o'z domeni: admin panel" "$admin_domain" admin.santexgo.uz
check "Faylda o'z domeni: hech narsa yozilmaydi" "$write_keys" ""

rm -f "$env_file"
SERVER_IP=
if (domains '') > "$WORK/out" 2>&1; then
  echo "✖ IP aniqlanmasa va domen berilmasa — xato bo'lishi kerak edi" >&2
  exit 1
fi
grep -q "IP manzilini aniqlab bo'lmadi" "$WORK/out"
check "IP aniqlanmasa — tushunarli xato" ok ok
SERVER_IP=203.0.113.7

# ── Eskiz (SMS) ──

inputs() {
  site=$1
  admin_domain=
  acme_email=ci@example.com
  eskiz_email=$2
  eskiz_password=$3
  admin_phone=+998901234567
  admin_password=ci-admin-password-123
  sample_products=false
  SMS_OFF=0
  collect_inputs > "$WORK/out"
}

rm -f "$env_file"
inputs '' '' ''
check "Eskiz berilmagan — SMS'siz" "$SMS_OFF:$sms_provider" 1:none
check "Eskiz'siz: faylga yoziladi" "$write_keys" \
  " SITE_DOMAIN ADMIN_DOMAIN ACME_EMAIL SMS_PROVIDER SEED_SAMPLE_PRODUCTS"

printf 'SITE_DOMAIN=203-0-113-7.sslip.io\nADMIN_DOMAIN=admin.203-0-113-7.sslip.io\nACME_EMAIL=ci@example.com\nESKIZ_EMAIL=\nESKIZ_PASSWORD=\nSMS_PROVIDER=none\nSEED_SAMPLE_PRODUCTS=false\n' > "$env_file"
inputs '' '' ''
check "Qayta, Eskiz'siz: hech narsa yozilmaydi" "$SMS_OFF:$write_keys" "1:"

inputs '' shop@example.com 'pa$$ #1'
check "Eskiz keyin ulandi" "$SMS_OFF:$sms_provider" 0:eskiz
check "Eskiz ulandi: faylga yoziladi" "$write_keys" " ESKIZ_EMAIL ESKIZ_PASSWORD SMS_PROVIDER"

if (inputs '' shop@example.com "it's") > "$WORK/out" 2>&1; then
  echo "✖ Apostrofli Eskiz paroli qabul qilinmasligi kerak edi" >&2
  exit 1
fi
check "Eskiz paroli tekshiriladi" ok ok

printf '\n✔ install.sh: domensiz va Eskiz'"'"'siz rejimlar to'"'"'g'"'"'ri ishlaydi\n'
