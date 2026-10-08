#!/bin/sh
# Production stack'ni tashqaridan tekshirish (smoke test) — Caddy orqali HTTPS bilan:
# sahifalar, yo'naltirishlar, xavfsizlik sarlavhalari (CSP nonce), admin API cheklovlari, CSRF,
# rasm yuklash (read-only API konteyneri), konteynerlar holati va zaxira nusxalar.
#
# CI'da (.github/workflows/ci.yml, "production" job) "sh scripts/prod.sh deploy | seed | admin"
# dan keyin ishga tushiriladi. Serverdagi kabi ishga tushirilgan lokal stack'da ham ishlaydi
# (SITE_DOMAIN=santexgo.localhost):
#   SMOKE_ADMIN_PHONE=+998... SMOKE_ADMIN_PASSWORD=... sh .github/scripts/prod-smoke.sh
#
# Xizmatlarni to'xtatmaydi va ma'lumotlarni o'zgartirmaydi: bitta mahsulotga sinov rasmi
# yuklanadi va tekshiruvdan so'ng o'chiriladi. Kerak: curl, jq, docker compose.
set -eu
cd "$(dirname "$0")/../.."

SITE=${SMOKE_SITE_DOMAIN:-santexgo.localhost}
ADMIN=${SMOKE_ADMIN_DOMAIN:-admin.$SITE}
ADMIN_PHONE=${SMOKE_ADMIN_PHONE:-+998901234567}
ADMIN_PASSWORD=${SMOKE_ADMIN_PASSWORD:-ci-admin-password-123}
# Seed'dan keyin API katalog keshi (kategoriyalar daraxti) 60 soniyada yangilanadi
WAIT_SECONDS=${SMOKE_WAIT_SECONDS:-90}
ENV_FILE=docker/.env.production
PRODUCT=plastherm-ppr-truba-d25-pn20-4-m
PRODUCT_SKU=PLT-PPR-PN20-25

TMP=$(mktemp -d)
JAR=$TMP/cookies
PRODUCT_ID=
IMAGE_ID=

ok() { printf '✔ %s\n' "$*"; }

fail() {
  printf '✖ %s\n' "$*" >&2
  exit 1
}

# Oxirgi HTTP javob tanasi bilan (xato sababini ko'rish uchun)
fail_response() {
  printf '✖ %s\n' "$*" >&2
  if [ -s "$TMP/body" ]; then
    printf '  Javob: %s\n' "$(head -c 500 "$TMP/body" | tr '\n' ' ')" >&2
  fi
  exit 1
}

# Barcha so'rovlar Caddy'ga (127.0.0.1:80/443) — DNS'siz, sertifikat Caddy'ning ichki CA'sidan
request() {
  curl -sk --max-time 30 \
    --resolve "$SITE:80:127.0.0.1" --resolve "$SITE:443:127.0.0.1" \
    --resolve "www.$SITE:80:127.0.0.1" --resolve "www.$SITE:443:127.0.0.1" \
    --resolve "$ADMIN:80:127.0.0.1" --resolve "$ADMIN:443:127.0.0.1" \
    "$@"
}

# So'rov: tana $TMP/body ga, sarlavhalar $TMP/headers ga yoziladi, stdout'ga HTTP kodi
fetch() {
  : > "$TMP/body"
  : > "$TMP/headers"
  request -D "$TMP/headers" -o "$TMP/body" -w '%{http_code}' "$@" || true
}

# Admin domenidagi API so'rovi: kirish cookie'lari bilan, brauzerdagi kabi Origin sarlavhasi
admin_fetch() {
  fetch -b "$JAR" -H "Origin: https://$ADMIN" "$@"
}

# Oxirgi javobdagi sarlavha qiymati
header() {
  grep -i "^$1:" "$TMP/headers" | tail -n 1 | sed 's/^[^:]*: *//' | tr -d '\r'
}

# expect_status <kod> <tavsif> <curl argumentlari...>
expect_status() {
  want=$1
  what=$2
  shift 2
  code=$(fetch "$@")
  [ "$code" = "$want" ] || fail_response "$what: HTTP $code (kutilgan $want)"
}

# expect_body <matn> <tavsif> — oxirgi javob tanasida
expect_body() {
  grep -qF -- "$1" "$TMP/body" || fail_response "$2: javobda \"$1\" topilmadi"
}

# expect_header <sarlavha> <qiymat qismi> <tavsif> — oxirgi javobda
expect_header() {
  value=$(header "$1")
  case "$value" in
    *"$2"*) ;;
    *) fail "$3: \"$1\" sarlavhasida \"$2\" yo'q (qiymat: \"$value\")" ;;
  esac
}

# expect_redirect <kod> <to'liq manzil> <tavsif> <URL>
expect_redirect() {
  : > "$TMP/body"
  result=$(request -o /dev/null -w '%{http_code} %{redirect_url}' "$4" || true)
  [ "$result" = "$1 $2" ] || fail "$3: \"$result\" (kutilgan: \"$1 $2\") — $4"
}

# wait_for <URL> <matn> <tavsif> — javob 200 va tanada matn bo'lguncha (WAIT_SECONDS gacha)
wait_for() {
  deadline=$(($(date +%s) + WAIT_SECONDS))
  while :; do
    code=$(fetch "$1")
    if [ "$code" = 200 ] && grep -qF -- "$2" "$TMP/body"; then
      return 0
    fi
    [ "$(date +%s)" -lt "$deadline" ] ||
      fail_response "$3: $WAIT_SECONDS soniyada tayyor bo'lmadi (oxirgi javob: HTTP $code) — $1"
    sleep 2
  done
}

# HTML sahifa xavfsizlik sarlavhalari (oxirgi javob bo'yicha)
expect_security_headers() {
  expect_header content-security-policy "'nonce-" "$1"
  expect_header content-security-policy "'strict-dynamic'" "$1"
  expect_header content-security-policy "frame-ancestors 'none'" "$1"
  expect_header strict-transport-security max-age= "$1"
  expect_header x-frame-options DENY "$1"
  expect_header x-content-type-options nosniff "$1"
  if grep -qi '^server:' "$TMP/headers"; then
    fail "$1: \"Server\" sarlavhasi yashirilmagan ($(header server))"
  fi
}

csp_nonce() {
  header content-security-policy | sed -n "s/.*'nonce-\([^']*\)'.*/\1/p"
}

cleanup() {
  status=$?
  if [ -n "$IMAGE_ID" ]; then
    # Tekshiruv yarim qolsa ham sinov rasmi o'chiriladi
    admin_fetch -X DELETE "https://$ADMIN/api/v1/admin/products/$PRODUCT_ID/images/$IMAGE_ID" \
      > /dev/null
  fi
  rm -rf "$TMP"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

command -v jq > /dev/null || fail "jq o'rnatilmagan"
[ -f "$ENV_FILE" ] || fail "$ENV_FILE yo'q — stack scripts/prod.sh bilan ishga tushirilmagan"

# ─────────────────────────── Xizmatlar holati ───────────────────────────

wait_for "https://$SITE/api/health" '"status":"ok"' "API sog'lig'i (Caddy orqali)"
ok "API, baza va Redis ishlayapti: https://$SITE/api/health"

for service in postgres redis api web admin backup; do
  health=$(sh scripts/prod.sh compose ps --format '{{.Health}}' "$service")
  [ "$health" = healthy ] ||
    fail "Konteyner \"$service\": \"${health:-ishlamayapti}\" (kutilgan: healthy)"
done
state=$(sh scripts/prod.sh compose ps --format '{{.State}}' caddy)
[ "$state" = running ] || fail "Konteyner \"caddy\": \"${state:-ishlamayapti}\" (kutilgan: running)"
ok "Konteynerlar: postgres, redis, api, web, admin, backup — healthy; caddy — running"

backup_dir=$(sed -n 's/^BACKUP_DIR=//p' "$ENV_FILE" | tail -n 1 | tr -d "\"'")
case "${backup_dir:=./backups}" in
  /*) ;;
  *) backup_dir=docker/${backup_dir#./} ;; # nisbiy yo'l — docker/ papkasiga nisbatan
esac
dumps=$(find "$backup_dir/db" -name 'santexgo-*.dump' 2> /dev/null | wc -l | tr -d ' ')
[ "$dumps" -gt 0 ] || fail "$backup_dir/db da zaxira nusxa (santexgo-*.dump) yo'q"
ok "Zaxira nusxalar: $dumps ta ($backup_dir/db)"

# ─────────────────────────────── Sayt ───────────────────────────────

wait_for "https://$SITE/products/$PRODUCT" "$PRODUCT_SKU" "Mahsulot sahifasi"
ok "Mahsulot sahifasi: /products/$PRODUCT ($PRODUCT_SKU)"

wait_for "https://$SITE/catalog/trubalar?material=ppr" PPR "Katalog (PPR filtri)"
ok "Katalog: /catalog/trubalar?material=ppr (PPR)"

expect_status 200 "Bosh sahifa" "https://$SITE/"
expect_body SantexGo "Bosh sahifa"
ok "Bosh sahifa: SantexGo"

expect_security_headers "Sayt (HTML)"
nonce=$(csp_nonce)
[ -n "$nonce" ] || fail "Sayt: CSP'dan nonce olinmadi"
# Next.js skriptlari sarlavhadagi nonce bilan belgilanadi — aks holda brauzer ularni bloklaydi
expect_body "nonce=\"$nonce\"" "Sayt: skriptlardagi nonce CSP sarlavhasiga mos"
expect_status 200 "Bosh sahifa (2-so'rov)" "https://$SITE/"
[ "$(csp_nonce)" != "$nonce" ] || fail "Sayt: ikki so'rovda CSP nonce bir xil"
ok "Sayt xavfsizlik sarlavhalari: CSP (nonce, strict-dynamic), HSTS, X-Frame-Options DENY," \
  "Server yo'q; nonce har so'rovda yangi"

expect_status 404 "Mavjud bo'lmagan mahsulot" "https://$SITE/products/mavjud-emas-smoke-test"
ok "Mavjud bo'lmagan mahsulot: 404"

expect_redirect 307 "https://$SITE/login?next=%2Faccount" "Kabinet (kirmasdan)" \
  "https://$SITE/account"
ok "Kabinet kirmagan foydalanuvchini /login?next=%2Faccount ga yo'naltiradi"

expect_redirect 308 "https://$SITE/catalog?ref=smoke" "HTTP → HTTPS" \
  "http://$SITE/catalog?ref=smoke"
expect_redirect 308 "https://$ADMIN/login" "HTTP → HTTPS (admin)" "http://$ADMIN/login"
ok "http:// → https:// (308)"

expect_redirect 301 "https://$SITE/catalog/trubalar?material=ppr" "www → asosiy domen" \
  "https://www.$SITE/catalog/trubalar?material=ppr"
ok "www.$SITE → $SITE (301, yo'l va parametrlar saqlanadi)"

# ─────────────────────────── Admin panel ───────────────────────────

expect_status 200 "Admin kirish sahifasi" "https://$ADMIN/login"
grep -q '<title>[^<]*SantexGo Admin' "$TMP/body" ||
  fail_response "Admin kirish sahifasi: <title> da \"SantexGo Admin\" yo'q"
expect_security_headers "Admin panel (HTML)"
ok "Admin kirish sahifasi: \"SantexGo Admin\", xavfsizlik sarlavhalari joyida"

expect_redirect 307 "https://$ADMIN/login?next=%2Forders" "Admin buyurtmalar (kirmasdan)" \
  "https://$ADMIN/orders"
ok "Admin panel kirmagan foydalanuvchini /login?next=%2Forders ga yo'naltiradi"

# ───────────────────────── Admin API va CSRF ─────────────────────────

for path in /api/v1/admin/stats/overview /api/v1/Admin/stats/overview \
  //api/v1/admin/stats/overview /api/v1/%61dmin/stats/overview; do
  expect_status 404 "Admin API sayt domenida ($path)" --path-as-is "https://$SITE$path"
done
ok "Admin API sayt domenida yopiq (404): /api/v1/admin, /Admin, //api, %61dmin"

expect_status 401 "Admin API (kirmasdan)" "https://$ADMIN/api/v1/admin/stats/overview"
ok "Admin API admin domenida kirmasdan: 401"

jq -n --arg phone "$ADMIN_PHONE" --arg password "$ADMIN_PASSWORD" \
  '{phone: $phone, password: $password}' > "$TMP/login.json"
expect_status 200 "Admin sifatida kirish ($ADMIN_PHONE)" -c "$JAR" -X POST \
  -H "Origin: https://$ADMIN" -H 'Content-Type: application/json' \
  --data-binary "@$TMP/login.json" "https://$ADMIN/api/v1/auth/login"
[ "$(jq -r '.user.role' "$TMP/body")" = ADMIN ] ||
  fail_response "$ADMIN_PHONE foydalanuvchisi admin emas"
expect_status 200 "Admin API (kirgan holda)" -b "$JAR" \
  "https://$ADMIN/api/v1/admin/stats/overview"
expect_body '"products"' "Admin API (kirgan holda)"
ok "Admin sifatida kirish ($ADMIN_PHONE): /api/v1/admin/stats/overview — 200"

# Begona saytdan cookie bilan kelgan so'rov rad etiladi. Tanasi noto'g'ri ({}): himoya
# ishlamay qolsa ham hech narsa yaratilmaydi (400)
expect_status 403 "CSRF: begona saytdan so'rov" -b "$JAR" -X POST \
  -H 'Origin: https://evil.example' -H 'Content-Type: application/json' --data '{}' \
  "https://$ADMIN/api/v1/admin/brands"
expect_body CSRF_REJECTED "CSRF"
expect_status 400 "O'z domenidan so'rov (noto'g'ri tana)" -b "$JAR" -X POST \
  -H "Origin: https://$ADMIN" -H 'Content-Type: application/json' --data '{}' \
  "https://$ADMIN/api/v1/admin/brands"
ok "CSRF: Origin https://evil.example — 403; o'z domeni — o'tkaziladi (validatsiya 400)"

# ─────────────────── Rasm yuklash (read-only API konteyneri) ───────────────────

expect_status 200 "Mahsulotlar ro'yxati (admin)" -b "$JAR" \
  "https://$ADMIN/api/v1/admin/products?pageSize=1"
PRODUCT_ID=$(jq -r '.items[0].id // empty' "$TMP/body")
[ -n "$PRODUCT_ID" ] || fail_response "Admin API: mahsulotlar ro'yxati bo'sh"
expect_status 200 "Mahsulot ($PRODUCT_ID)" -b "$JAR" \
  "https://$ADMIN/api/v1/admin/products/$PRODUCT_ID"
jq -r '.images[].id' "$TMP/body" > "$TMP/images-before"

# 16x16 PNG (to'q sariq)
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mO46SFPEmIY1TCqYfhqAADZxkAQ7D8XygAAAABJRU5ErkJggg==' |
  base64 -d > "$TMP/smoke.png"
expect_status 201 "Rasm yuklash" -b "$JAR" -H "Origin: https://$ADMIN" -X POST \
  -F "files=@$TMP/smoke.png;type=image/png" \
  "https://$ADMIN/api/v1/admin/products/$PRODUCT_ID/images"
IMAGE_ID=$(jq -r '.[].id' "$TMP/body" | grep -vxF -f "$TMP/images-before" | head -n 1)
[ -n "$IMAGE_ID" ] || fail_response "Rasm yuklash: javobda yangi rasm yo'q"
medium=$(jq -r --arg id "$IMAGE_ID" '.[] | select(.id == $id) | .medium' "$TMP/body")
case "$medium" in
  http://* | https://*) medium_url=$medium ;;
  *) medium_url=https://$SITE$medium ;;
esac

expect_status 200 "Yuklangan rasm (sayt domenida)" "$medium_url"
expect_header content-type image/webp "Yuklangan rasm"
[ "$(head -c 12 "$TMP/body" | tail -c 4)" = WEBP ] || fail "Yuklangan rasm: fayl WebP emas"
ok "Rasm yuklash: PNG → WebP, $medium_url — 200 image/webp"

expect_status 200 "Sinov rasmini o'chirish" -b "$JAR" -H "Origin: https://$ADMIN" -X DELETE \
  "https://$ADMIN/api/v1/admin/products/$PRODUCT_ID/images/$IMAGE_ID"
IMAGE_ID=
expect_status 404 "O'chirilgan rasm" "$medium_url"
ok "Sinov rasmi o'chirildi (fayl ham: 404)"

printf '\n✔ Production smoke test muvaffaqiyatli: https://%s, https://%s\n' "$SITE" "$ADMIN"
