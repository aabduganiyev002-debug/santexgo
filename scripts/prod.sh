#!/bin/sh
# SantexGo — production serverni boshqarish. Loyiha papkasidan: sh scripts/prod.sh <buyruq>
# To'liq qo'llanma: docs/DEPLOY.md
set -eu
cd "$(dirname "$0")/.."

ENV_FILE=docker/.env.production
COMPOSE_FILE=docker/docker-compose.prod.yml
EXAMPLE_FILE=docker/.env.production.example
# Rollback uchun saqlanadigan oldingi versiyalar soni
KEEP_VERSIONS=5
IMAGES="api web admin migrate backup"

usage() {
  cat <<'EOF'
Foydalanish: sh scripts/prod.sh <buyruq>

O'rnatish va yangilash:
  init [domen] [admin-domen] [email]  docker/.env.production yaratish (parollar avtomatik)
  deploy                              build, migratsiyalar va ishga tushirish (yangilash ham shu)
  seed                                ma'lumotnomalar: kategoriyalar, materiallar, ombor (bir marta)
  admin                               admin akkaunt yaratish yoki mavjud foydalanuvchini admin qilish
  versions | rollback <versiya>       oldingi versiyalar va ularga qaytish

Kundalik:
  status | logs [xizmat] | stop | start | restart [xizmat]
  backup                              hozir zaxira nusxa yaratish
  backups                             zaxira nusxalar ro'yxati
  restore <fayl>                      bazani zaxira nusxadan tiklash
  psql [argumentlar]                  baza konsoli
  compose <argumentlar>               istalgan "docker compose" buyrug'i
EOF
}

die() {
  printf '✖ %s\n' "$*" >&2
  exit 1
}
info() { printf '▸ %s\n' "$*"; }

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

# .env.production dagi qiymat (qo'shtirnoqlarsiz)
env_value() {
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed "s/^[\"']//; s/[\"']\$//"
}

# KEY=VALUE ni yozish yoki almashtirish (VALUE: domen, email yoki hex)
set_value() {
  awk -v key="$1" -v value="$2" '
    index($0, key "=") == 1 { print key "=" value; done = 1; next }
    { print }
    END { if (!done) print key "=" value }
  ' "$ENV_FILE" > "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
}

random_hex() { od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'; }

require_env() {
  [ -f "$ENV_FILE" ] || die "$ENV_FILE yo'q. Avval: sh scripts/prod.sh init"
  for key in SITE_DOMAIN ADMIN_DOMAIN ACME_EMAIL POSTGRES_PASSWORD REDIS_PASSWORD AUTH_SECRET; do
    [ -n "$(env_value "$key")" ] || die "$ENV_FILE: $key berilmagan"
  done
  [ "$(env_value AUTH_SECRET | wc -c)" -gt 32 ] || die "AUTH_SECRET kamida 32 belgi bo'lishi kerak"
  if [ "$(env_value SMS_PROVIDER)" != console ]; then
    [ -n "$(env_value ESKIZ_EMAIL)" ] && [ -n "$(env_value ESKIZ_PASSWORD)" ] ||
      die "$ENV_FILE: ESKIZ_EMAIL va ESKIZ_PASSWORD berilmagan (SMS uchun Eskiz.uz akkaunti)"
  fi
  case "$(env_value POSTGRES_PASSWORD)$(env_value REDIS_PASSWORD)" in
    *[!A-Za-z0-9]*) die "POSTGRES_PASSWORD va REDIS_PASSWORD faqat harf va raqamlardan iborat bo'lsin" ;;
  esac
}

cmd_init() {
  [ ! -f "$ENV_FILE" ] || die "$ENV_FILE allaqachon mavjud — ustiga yozilmaydi"
  site=${1:-}
  admin=${2:-}
  email=${3:-}
  if [ -z "$site" ]; then
    printf 'Sayt domeni (masalan: santexgo.uz): '
    read -r site
  fi
  if [ -z "$admin" ]; then
    printf 'Admin panel domeni [admin.%s]: ' "$site"
    read -r admin
    admin=${admin:-admin.$site}
  fi
  if [ -z "$email" ]; then
    printf 'Email (HTTPS sertifikati xabarlari uchun): '
    read -r email
  fi
  for domain in "$site" "$admin"; do
    printf '%s' "$domain" | grep -Eq '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' ||
      die "Noto'g'ri domen: $domain (kichik harflar, masalan: santexgo.uz)"
  done
  printf '%s' "$email" | grep -Eq '^[^@ ]+@[^@ ]+\.[^@ ]+$' || die "Noto'g'ri email: $email"

  umask 077
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  set_value SITE_DOMAIN "$site"
  set_value ADMIN_DOMAIN "$admin"
  set_value ACME_EMAIL "$email"
  set_value POSTGRES_PASSWORD "$(random_hex 24)"
  set_value REDIS_PASSWORD "$(random_hex 24)"
  set_value AUTH_SECRET "$(random_hex 32)"
  info "Yaratildi: $ENV_FILE (parollar va kalitlar tasodifiy)"
  info "Endi faylda Eskiz SMS sozlamalarini kiriting: ESKIZ_EMAIL, ESKIZ_PASSWORD"
  info "So'ng: sh scripts/prod.sh deploy"
}

# Eng yangi KEEP_VERSIONS versiyadan eskilari o'chiriladi (konteyner ishlatayotgani qoladi)
prune_versions() {
  for name in $IMAGES; do
    docker images "santexgo-$name" --format '{{.Tag}}' | grep -v '^latest$' |
      tail -n +"$((KEEP_VERSIONS + 1))" | while read -r tag; do
      docker rmi "santexgo-$name:$tag" > /dev/null 2>&1 || true
    done
  done
  docker image prune -f > /dev/null
}

cmd_deploy() {
  require_env
  version=$(git rev-parse --short HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)
  info "Bazaviy image'lar yangilanmoqda (xavfsizlik yangilanishlari)..."
  compose pull --ignore-buildable --quiet
  info "Image'lar build qilinmoqda (versiya: $version)..."
  IMAGE_TAG=$version compose build --pull
  info "Ishga tushirilmoqda (yangi migratsiyalar avtomatik qo'llanadi)..."
  IMAGE_TAG=$version compose up -d --remove-orphans --wait --wait-timeout 300
  prune_versions
  info "Tayyor (versiya $version):"
  info "  Sayt:        https://$(env_value SITE_DOMAIN)"
  info "  Admin panel: https://$(env_value ADMIN_DOMAIN)"
}

cmd_seed() {
  require_env
  compose run --rm migrate pnpm exec prisma db seed
  info "Katalog saytda 1 daqiqa ichida yangilanadi (API keshi)"
}

cmd_admin() {
  require_env
  phone=${ADMIN_PHONE:-}
  password=${ADMIN_PASSWORD:-}
  if [ -z "$phone" ]; then
    printf 'Admin telefon raqami (+998XXXXXXXXX): '
    read -r phone
  fi
  if [ -z "$password" ]; then
    printf 'Parol (kamida 10 belgi; mavjud foydalanuvchi uchun e%stiborga olinmaydi): ' "'"
    stty -echo 2> /dev/null || true
    IFS= read -r password
    stty echo 2> /dev/null || true
    printf '\n'
  fi
  # Parol buyruq qatorida ko'rinmasligi uchun muhit orqali uzatiladi
  ADMIN_PHONE=$phone ADMIN_PASSWORD=$password compose run --rm \
    -e SEED_SCOPE=admin -e ADMIN_PHONE -e ADMIN_PASSWORD migrate pnpm exec prisma db seed
}

cmd_versions() {
  docker images santexgo-api --format 'table {{.Tag}}\t{{.CreatedSince}}' | grep -v '^latest '
}

cmd_rollback() {
  version=${1:-}
  [ -n "$version" ] || die "Versiya ko'rsatilmagan. Ro'yxat: sh scripts/prod.sh versions"
  require_env
  for name in $IMAGES; do
    docker image inspect "santexgo-$name:$version" > /dev/null 2>&1 ||
      die "santexgo-$name:$version topilmadi. Ro'yxat: sh scripts/prod.sh versions"
  done
  info "Diqqat: baza migratsiyalari orqaga qaytarilmaydi. Muammo bo'lsa: sh scripts/prod.sh restore"
  for name in $IMAGES; do
    docker tag "santexgo-$name:$version" "santexgo-$name:latest"
  done
  compose up -d --no-build --remove-orphans --wait --wait-timeout 300
  info "Versiya $version ishga tushirildi"
}

cmd_restore() {
  file=${1:-}
  [ -n "$file" ] || die "Zaxira fayli ko'rsatilmagan. Ro'yxat: sh scripts/prod.sh backups"
  require_env
  answer=${CONFIRM:-}
  if [ "$answer" != HA ]; then
    printf 'Baza "%s" holatiga qaytariladi, undan keyingi o%szgarishlar yo%sqoladi.\n' "$file" "'" "'"
    printf 'Davom etish uchun HA deb yozing: '
    read -r answer
  fi
  [ "$answer" = HA ] || die "Bekor qilindi"
  info "API, sayt va admin panel to'xtatilmoqda..."
  compose stop web admin api
  status=0
  compose exec -T backup restore.sh "$file" || status=$?
  info "Qayta ishga tushirilmoqda..."
  compose up -d --no-build --wait --wait-timeout 300
  [ "$status" -eq 0 ] || die "Tiklash muvaffaqiyatsiz — joriy baza o'zgarmadi"
}

cmd_psql() {
  user=$(env_value POSTGRES_USER)
  db=$(env_value POSTGRES_DB)
  compose exec postgres psql -U "${user:-santexgo}" -d "${db:-santexgo}" "$@"
}

command=${1:-help}
[ $# -eq 0 ] || shift
case "$command" in
  init) cmd_init "$@" ;;
  deploy) cmd_deploy ;;
  seed) cmd_seed ;;
  admin) cmd_admin ;;
  versions) cmd_versions ;;
  rollback) cmd_rollback "$@" ;;
  status) compose ps ;;
  logs) compose logs -f --tail 200 "$@" ;;
  stop) compose stop ;;
  start) compose up -d --no-build --wait --wait-timeout 300 ;;
  restart) compose restart "$@" ;;
  backup) compose exec -T backup backup.sh ;;
  backups) compose exec -T backup ls -lh /backups/db ;;
  restore) cmd_restore "$@" ;;
  psql) cmd_psql "$@" ;;
  compose) compose "$@" ;;
  help | -h | --help) usage ;;
  *)
    usage >&2
    exit 1
    ;;
esac
