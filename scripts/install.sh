#!/bin/sh
# SantexGo — serverga bitta buyruq bilan o'rnatish va yangilash (Ubuntu 22.04/24.04, Debian 12).
#
#   curl -fsSL https://raw.githubusercontent.com/aabduganiyev002-debug/santexgo/main/scripts/install.sh -o install.sh && sudo sh install.sh
#
# Avval savollar (domen, email, Eskiz SMS, admin), keyin hammasi avtomatik: tizim paketlari,
# xavfsizlik yangilanishlari, swap, firewall, Docker, kod (git), docker/.env.production va
# "sh scripts/prod.sh deploy | seed | admin". Qayta ishga tushirish xavfsiz: o'rnatilgan serverda
# faqat yangilaydi (git pull + deploy), mavjud sozlamalar qayta so'ralmaydi.
#
# Domen bo'lmasa — sayt bepul manzilda ochiladi: <server IP>.sslip.io (HTTPS bilan). Eskiz.uz
# akkaunti bo'lmasa — sayt SMS'siz ishga tushadi (mijozlar ro'yxatdan o'ta olmaydi). Ikkalasini
# ham keyin ulash mumkin: o'rnatish buyrug'ini qayta berish kifoya — domen va Eskiz so'raladi.
#
# So'rovsiz ishga tushirish — qiymatlar muhit o'zgaruvchilarida (berilganlari so'ralmaydi):
#   sudo SITE_DOMAIN=santexgo.uz ACME_EMAIL=... ESKIZ_EMAIL=... ESKIZ_PASSWORD=... \
#     ADMIN_PHONE=+998901234567 ADMIN_PASSWORD=... sh install.sh
# Ixtiyoriy: SITE_DOMAIN (yo'q — bepul manzil), ADMIN_DOMAIN (admin.<domen>), ESKIZ_EMAIL va
#   ESKIZ_PASSWORD (yo'q — SMS'siz), INSTALL_DIR (/opt/santexgo), SANTEXGO_REPO, SANTEXGO_BRANCH
#   (main), SEED_SAMPLE_PRODUCTS (false), SKIP_FIREWALL=1, SKIP_DNS_CHECK=1
#
# Qo'llanma: docs/DEPLOY.md ("Tezkor o'rnatish — bitta buyruq")
set -eu

DEFAULT_REPO=https://github.com/aabduganiyev002-debug/santexgo.git
DEFAULT_DIR=/opt/santexgo
DEFAULT_BRANCH=main
INSTALL_URL=https://raw.githubusercontent.com/aabduganiyev002-debug/santexgo/main/scripts/install.sh
DOCS_URL=https://github.com/aabduganiyev002-debug/santexgo/blob/main/docs/DEPLOY.md
# docker/docker-compose.prod.yml dagi "name:" — konteyner va hajm nomlari shundan boshlanadi
PROJECT=santexgo-prod
# Bepul manzillar: <IP, nuqtalar o'rniga chiziqcha>.sslip.io — DNS javobi nomdagi IP (sslip.io)
FREE_DOMAIN_SUFFIX=sslip.io
TOTAL_STEPS=9
MIN_PASSWORD_LENGTH=10
DOMAIN_RE='^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
EMAIL_RE='^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
IPV4_RE='^[0-9]{1,3}(\.[0-9]{1,3}){3}$'
NL='
'
CR=$(printf '\r')

STEP=0
STEP_TITLE=
INTERACTIVE=0
SMS_OFF=0
ASKED=0
ECHO_OFF=0
TMP_DIR=

# ─────────────────────────────── Chiqish ───────────────────────────────

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  B=$(printf '\033[1m')
  G=$(printf '\033[32m')
  Y=$(printf '\033[33m')
  R=$(printf '\033[31m')
  N=$(printf '\033[0m')
else
  B='' G='' Y='' R='' N=''
fi

say() { printf '%s\n' "$*"; }
info() { printf '  %s\n' "$*"; }
ok() { printf '  %s✔%s %s\n' "$G" "$N" "$*"; }
note() { printf '  %s!%s %s\n' "$Y" "$N" "$*"; }
die() {
  printf '%s✖ %s%s\n' "$R" "$*" "$N" >&2
  exit 1
}

step() {
  STEP=$((STEP + 1))
  STEP_TITLE=$1
  printf '\n%s[%s/%s] %s%s\n' "$B" "$STEP" "$TOTAL_STEPS" "$1" "$N"
}

elapsed() {
  seconds=$(($(date +%s) - START))
  printf '%d daqiqa %02d soniya' $((seconds / 60)) $((seconds % 60))
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
trim() { printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }

# ─────────────────── Savollar (terminaldan: "curl ... | sudo sh" da ham) ───────────────────

ask() {
  if [ -n "${2:-}" ]; then
    printf '  %s [%s]: ' "$1" "$2" > /dev/tty
  else
    printf '  %s: ' "$1" > /dev/tty
  fi
  IFS= read -r answer < /dev/tty || die "Bekor qilindi"
  [ -n "$answer" ] || answer=${2:-}
  ASKED=1
}

# Yashirin kiritish (parollar ekranda ko'rinmaydi)
ask_secret() {
  printf '  %s: ' "$1" > /dev/tty
  ECHO_OFF=1
  stty -echo < /dev/tty 2> /dev/null || true
  IFS= read -r answer < /dev/tty || die "Bekor qilindi"
  restore_echo
  printf '\n' > /dev/tty
  ASKED=1
}

restore_echo() {
  if [ "$ECHO_OFF" = 1 ]; then
    stty echo < /dev/tty 2> /dev/null || true
    ECHO_OFF=0
  fi
}

# confirm <savol> — "ha" (standart) bo'lsa 0. So'rovsiz rejimda har doim ha
confirm() {
  if [ "$INTERACTIVE" != 1 ]; then
    info "$1 — ha (so'rovsiz rejim)"
    return 0
  fi
  while :; do
    ask "$1 (ha/yo'q)" ha
    case $(lower "$(trim "$answer")") in
      ha | h | yes) return 0 ;;
      n | no | yo*) return 1 ;;
    esac
    note "\"ha\" yoki \"yo'q\" deb yozing"
  done
}

# input <o'zgaruvchi> <muhit nomi> <tekshiruv> <savol> [standart]
# Qiymat muhit o'zgaruvchisidan yoki savol orqali; tekshiruv funksiyasi to'g'ri qiymatni (yoki xato
# matnini) chiqaradi. So'rovsiz rejimda noto'g'ri yoki berilmagan qiymat — xato
input() {
  eval "value=\${$1}"
  if [ -z "$value" ] && [ "$INTERACTIVE" != 1 ]; then value=${5:-}; fi
  while :; do
    if [ -z "$value" ]; then
      [ "$INTERACTIVE" = 1 ] ||
        die "$2 berilmagan (so'rovsiz rejimda uni muhit o'zgaruvchisi sifatida bering)"
      ask "$4" "${5:-}"
      value=$answer
    fi
    if result=$("$3" "$value"); then
      eval "$1=\$result"
      return 0
    fi
    [ "$INTERACTIVE" = 1 ] || die "$2: $result"
    note "$result"
    value=
  done
}

# input_optional <o'zgaruvchi> <muhit nomi> <tekshiruv> <savol> — input kabi, lekin bo'sh qoldirish
# mumkin (Enter yoki muhit o'zgaruvchisi berilmagan): unda 1 qaytaradi
input_optional() {
  eval "value=\${$1}"
  while :; do
    if [ -z "$value" ]; then
      [ "$INTERACTIVE" = 1 ] || return 1
      ask "$4"
      value=$(trim "$answer")
      [ -n "$value" ] || return 1
    fi
    if result=$("$3" "$value"); then
      eval "$1=\$result"
      return 0
    fi
    [ "$INTERACTIVE" = 1 ] || die "$2: $result"
    note "$result"
    value=
  done
}

# input_secret <o'zgaruvchi> <muhit nomi> <tekshiruv> <savol> [takrorlash]
input_secret() {
  eval "value=\${$1}"
  while :; do
    typed=0
    if [ -z "$value" ]; then
      [ "$INTERACTIVE" = 1 ] ||
        die "$2 berilmagan (so'rovsiz rejimda uni muhit o'zgaruvchisi sifatida bering)"
      ask_secret "$4"
      value=$answer
      typed=1
    fi
    if result=$("$3" "$value"); then
      if [ "$typed" = 1 ] && [ -n "${5:-}" ]; then
        ask_secret "Parolni takrorlang"
        if [ "$answer" != "$value" ]; then
          note "Parollar mos kelmadi — qaytadan kiriting"
          value=
          continue
        fi
      fi
      eval "$1=\$result"
      return 0
    fi
    [ "$INTERACTIVE" = 1 ] || die "$2: $result"
    note "$result"
    value=
  done
}

# ─────────────── Tekshiruvlar: to'g'ri qiymatni yoki xato matnini chiqaradi ───────────────

# Domen: kichik harflarga o'tkaziladi; "https://", yo'l va port olib tashlanadi
v_domain() {
  domain=$(lower "$(trim "$1")" | sed -e 's|^[a-z][a-z0-9+.-]*://||' -e 's|[/?#:].*$||' -e 's/\.$//')
  if printf '%s' "$domain" | grep -Eq "$IPV4_RE"; then
    printf '%s' "IP manzil emas, domen kerak (masalan: santexgo.uz)"
    return 1
  fi
  if ! printf '%s' "$domain" | grep -Eq "$DOMAIN_RE"; then
    printf '%s' "Noto'g'ri domen: \"$1\" (lotin harflari, masalan: santexgo.uz)"
    return 1
  fi
  printf '%s' "$domain"
}

# Sayt domeni "www." siz: www.<domen> → <domen> yo'naltirishni Caddy o'zi qiladi
v_site_domain() {
  domain=$(v_domain "$1") || {
    printf '%s' "$domain"
    return 1
  }
  case "$domain" in www.*.*) domain=${domain#www.} ;; esac
  printf '%s' "$domain"
}

v_admin_domain() {
  domain=$(v_domain "$1") || {
    printf '%s' "$domain"
    return 1
  }
  if [ "$domain" = "$site" ] || [ "$domain" = "www.$site" ]; then
    printf '%s' "Admin panel domeni sayt domenidan farq qilsin (masalan: admin.$site)"
    return 1
  fi
  printf '%s' "$domain"
}

v_email() {
  email=$(trim "$1")
  if ! printf '%s' "$email" | grep -Eq "$EMAIL_RE"; then
    printf '%s' "Noto'g'ri email: \"$1\""
    return 1
  fi
  printf '%s' "$email"
}

# Sozlamalar fayliga bittalik qo'shtirnoq ichida yoziladi ('...'): $, # va bo'shliqlar o'zgarmaydi.
# Docker compose bunday qiymatda ' belgisini va oxiridagi \ ni o'qiy olmaydi
v_file_secret() {
  case "$1" in
    "")
      printf '%s' "Bo'sh bo'lmasin"
      return 1
      ;;
    *"'"*)
      printf '%s' "Parolda ' (apostrof) bo'lmasin — Eskiz kabinetida parolni o'zgartirib, qayta kiriting"
      return 1
      ;;
    *"$NL"* | *"$CR"*)
      printf '%s' "Parol bir qatorda bo'lsin"
      return 1
      ;;
    *\\)
      printf '%s' "Parol \\ belgisi bilan tugamasin"
      return 1
      ;;
  esac
  printf '%s' "$1"
}

# Telefon: "+998 90 123-45-67", "998901234567", "901234567" → +998901234567
v_phone() {
  digits=$(printf '%s' "$1" | tr -cd '0-9')
  case "$digits" in 998?????????) digits=${digits#998} ;; esac
  if printf '%s' "$digits" | grep -Eq '^[1-9][0-9]{8}$'; then
    printf '+998%s' "$digits"
    return 0
  fi
  printf '%s' "Noto'g'ri telefon raqami: \"$1\" (format: +998901234567)"
  return 1
}

v_admin_password() {
  if [ "${#1}" -lt "$MIN_PASSWORD_LENGTH" ]; then
    printf '%s' "Parol kamida $MIN_PASSWORD_LENGTH belgi bo'lsin"
    return 1
  fi
  printf '%s' "$1"
}

v_bool() {
  case $(lower "$(trim "$1")") in
    true | 1 | yes | ha) printf true ;;
    false | 0 | no | "yo'q" | yoq) printf false ;;
    *)
      printf '%s' "true yoki false bo'lishi kerak: \"$1\""
      return 1
      ;;
  esac
}

is_yes() {
  case $(lower "${1:-}") in 1 | true | yes | ha) return 0 ;; esac
  return 1
}

# ─────────────────────────── Sozlamalar fayli ───────────────────────────

# docker/.env.production dagi qiymat — scripts/prod.sh (env_value) va docker compose o'qigandek
env_get() {
  [ -f "$env_file" ] || return 0
  awk -v key="$1" '
    { sub(/\r$/, "") }
    index($0, key "=") == 1 { value = substr($0, length(key) + 2); found = 1 }
    END {
      if (!found) exit
      if (value ~ /^"/) { sub(/^"/, "", value); sub(/".*$/, "", value) }
      else if (value ~ /^\047/) { sub(/^\047/, "", value); sub(/\047.*$/, "", value) }
      else { sub(/[ \t]+#.*$/, "", value); sub(/[ \t]+$/, "", value) }
      print value
    }
  ' "$env_file"
}

# env_put <KALIT> <qator qiymati> — yozish yoki almashtirish (fayl huquqlari 600). Qiymat awk'ka
# muhit orqali beriladi: "\" belgilari o'zgarmaydi va parol jarayonlar ro'yxatida ko'rinmaydi
env_put() {
  (
    umask 077
    ENV_LINE="$1=$2" awk -v key="$1" '
      index($0, key "=") == 1 { if (!done) print ENVIRON["ENV_LINE"]; done = 1; next }
      { print }
      END { if (!done) print ENVIRON["ENV_LINE"] }
    ' "$env_file" > "$env_file.tmp"
  )
  mv "$env_file.tmp" "$env_file"
}

# from_file <o'zgaruvchi> <KALIT> — qiymat sozlamalar faylida bo'lsa, o'shani oladi (qayta so'ralmaydi)
from_file() {
  file_value=$(env_get "$2")
  [ -n "$file_value" ] || return 1
  eval "given=\${$1}"
  if [ -n "$given" ] && [ "$given" != "$file_value" ]; then
    case "$2" in
      *PASSWORD) shown= ;;
      *) shown=": $file_value" ;;
    esac
    note "$2 sozlamalar faylidagicha qoldi$shown (o'zgartirish: docker/.env.production, DEPLOY.md 6.2)"
  fi
  eval "$1=\$file_value"
}

# ──────────────────────────── Git va Docker ────────────────────────────

# Git loyiha papkasi egasi nomidan: papka boshqa foydalanuvchiniki bo'lsa (masalan, deploy),
# fayllar root'ga o'tib qolmasin va o'sha foydalanuvchining SSH kaliti ishlatilsin
repo_git() {
  if [ "$repo_owner" = root ]; then
    git -C "$repo_dir" "$@"
  else
    runuser -u "$repo_owner" -- env HOME="$repo_home" git -C "$repo_dir" "$@"
  fi
}

docker_ready() { command -v docker > /dev/null 2>&1 && docker info > /dev/null 2>&1; }

# Shu serverda SantexGo qaysi papkada o'rnatilgan (konteynerlar yorlig'idan), bo'lmasa — bo'sh
installed_dir() {
  docker_ready || return 0
  docker ps -a --filter "label=com.docker.compose.project=$PROJECT" \
    --format '{{.Label "com.docker.compose.project.working_dir"}}' 2> /dev/null |
    sed -n 's|/docker/*$||p' | sort -u | head -n 1
}

has_database() { docker_ready && docker volume inspect "${PROJECT}_postgres_data" > /dev/null 2>&1; }

db_query() {
  # shellcheck disable=SC2016 # $POSTGRES_USER konteyner ichida ochiladi
  printf '%s\n' "$1" | sh "$repo_dir/scripts/prod.sh" compose exec -T postgres \
    sh -c 'psql -X -q -t -A -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' 2> /dev/null
}

# Admin akkaunt bormi: yes | no | unknown (baza to'xtatilgan — deploy'dan keyin aniqlanadi)
admin_state() {
  has_database || {
    echo no
    return 0
  }
  has_users=$(db_query "SELECT to_regclass('public.users') IS NOT NULL;") || {
    echo unknown
    return 0
  }
  [ "$has_users" = t ] || {
    echo no
    return 0
  }
  admins=$(db_query "SELECT count(*) FROM users WHERE role = 'ADMIN' AND is_active;") || admins=
  case "$admins" in
    '' | *[!0-9]*) echo unknown ;;
    0) echo no ;;
    *) echo yes ;;
  esac
}

# ──────────────────────────────── DNS ────────────────────────────────

public_ipv4() {
  for url in https://api.ipify.org https://ifconfig.me/ip https://icanhazip.com; do
    ip=$(curl -4 -fsS --max-time 10 "$url" 2> /dev/null | tr -d ' \r\n') || continue
    if printf '%s' "$ip" | grep -Eq "$IPV4_RE"; then
      printf '%s\n' "$ip"
      return 0
    fi
  done
  return 1
}

# Bepul manzil: server IP'si nomning ichida (185.74.5.12 → 185-74-5-12.sslip.io). sslip.io DNS'i
# shu IP'ni qaytaradi — domen sotib olish va DNS sozlash shart emas; HTTPS sertifikatini Caddy
# odatdagidek oladi. www.<manzil> va admin.<manzil> ham shu IP'ga ochiladi
free_domain() {
  ip=$(public_ipv4) || return 1
  printf '%s.%s' "$(printf '%s' "$ip" | tr . -)" "$FREE_DOMAIN_SUFFIX"
}

is_free_domain() {
  case "$1" in *."$FREE_DOMAIN_SUFFIX") return 0 ;; esac
  return 1
}

# dns_lookup <nom> <A|AAAA> — avval Google DNS (HTTPS orqali: server keshi va /etc/hosts ta'sir
# qilmaydi, Let's Encrypt ko'radigan holatga yaqin), bo'lmasa — tizim resolver'i
dns_lookup() {
  if json=$(curl -fsS --max-time 10 "https://dns.google/resolve?name=$1&type=$2" 2> /dev/null); then
    printf '%s' "$json" | tr ',{}' '[\n*]' | sed -n 's/^"data":"\([^"]*\)"$/\1/p'
  elif [ "$2" = A ]; then
    getent ahostsv4 "$1" 2> /dev/null | awk '{ print $1 }' | grep -v '^127\.'
  else
    getent ahostsv6 "$1" 2> /dev/null | awk '{ print $1 }' | grep -v -e '^::ffff:' -e '^::1$'
  fi | if [ "$2" = A ]; then grep -E "$IPV4_RE"; else grep ':'; fi | sort -u
}

check_dns() {
  if is_yes "${SKIP_DNS_CHECK:-}"; then
    note "SKIP_DNS_CHECK=1 — DNS tekshirilmadi"
    return 0
  fi
  case "$site" in
    *.localhost | localhost)
      ok "$site — sinov domeni, DNS kerak emas (sertifikat Caddy'ning ichki CA'sidan)"
      return 0
      ;;
  esac
  if is_free_domain "$site"; then
    ok "$site — bepul manzil, DNS sozlash shart emas"
    return 0
  fi
  if ! command -v curl > /dev/null 2>&1; then
    note "curl yo'q — DNS tekshirilmadi"
    return 0
  fi
  server_ip=$(public_ipv4) || server_ip=
  if [ -n "$server_ip" ]; then
    info "Server IP manzili: $server_ip"
  else
    note "Serverning tashqi IP manzilini aniqlab bo'lmadi — faqat DNS yozuvlari ko'rsatiladi"
  fi
  dns_problem=0
  for name in "$site" "www.$site" "$admin_domain"; do
    records=$(dns_lookup "$name" A | tr '\n' ' ' | sed 's/ *$//')
    if [ -z "$records" ]; then
      note "$name — A yozuv topilmadi"
      dns_problem=1
    elif [ -n "$server_ip" ] && [ "$records" != "$server_ip" ]; then
      note "$name → $records (server IP'si emas: $server_ip)"
      dns_problem=1
    else
      ok "$name → $records"
    fi
    if [ -n "$(dns_lookup "$name" AAAA)" ]; then
      note "$name — AAAA (IPv6) yozuv bor: uni DNS panelida o'chiring (DEPLOY.md, 3-bo'lim)"
      dns_problem=1
    fi
  done
  [ "$dns_problem" = 1 ] || return 0
  say ""
  info "DNS panelida 3 ta A yozuvni server IP'siga qarating: @, www va admin (DEPLOY.md, 3-bo'lim)."
  info "Yangi yozuvlar 5–30 daqiqada tarqaladi. Davom etsangiz, sayt baribir ishga tushadi —"
  info "HTTPS sertifikatini Caddy DNS to'g'rilangandan keyin o'zi oladi."
  confirm "Davom etilsinmi?" || die "To'xtatildi: DNS'ni sozlab, buyruqni qayta bering"
}

# ────────────────────────────── Bosqichlar ──────────────────────────────

check_system() {
  os_id=$(awk -F= '$1 == "ID" { gsub(/"/, "", $2); print $2 }' /etc/os-release 2> /dev/null || true)
  os_version=$(awk -F= '$1 == "VERSION_ID" { gsub(/"/, "", $2); print $2 }' /etc/os-release 2> /dev/null || true)
  os_name=$(awk -F= '$1 == "PRETTY_NAME" { gsub(/"/, "", $2); print $2 }' /etc/os-release 2> /dev/null || true)
  [ -n "$os_name" ] || os_name="noma'lum tizim"
  arch=$(uname -m)
  warn=0
  case "$os_id:$os_version" in
    ubuntu:22.04 | ubuntu:24.04 | debian:12) ok "Tizim: $os_name ($arch)" ;;
    *)
      note "Bu tizimda sinab ko'rilmagan: $os_name. Tavsiya: Ubuntu 24.04 LTS"
      warn=1
      ;;
  esac
  if [ "$arch" != x86_64 ]; then
    note "Protsessor arxitekturasi $arch — sinab ko'rilmagan (tavsiya: x86_64)"
    warn=1
  fi
  if [ "$warn" = 1 ]; then
    confirm "Baribir davom etilsinmi?" || die "Bekor qilindi"
  fi
  command -v apt-get > /dev/null 2>&1 || die "Faqat Ubuntu va Debian (apt) qo'llab-quvvatlanadi"
}

# Kod qayerda: INSTALL_DIR; skript loyiha ichidan ishga tushirilgan bo'lsa — o'sha papka; shu
# serverda SantexGo boshqa papkada o'rnatilgan bo'lsa — o'sha; aks holda /opt/santexgo
locate_repo() {
  from_checkout=0
  if [ -n "$install_dir" ]; then
    case "$install_dir" in
      /?*) ;;
      *) die "INSTALL_DIR to'liq yo'l bo'lsin (masalan: /opt/santexgo)" ;;
    esac
    repo_dir=${install_dir%/}
    if [ -d "$repo_dir" ]; then repo_dir=$(cd "$repo_dir" && pwd -P); fi
  elif repo_dir=$(script_checkout); then
    from_checkout=1
  else
    repo_dir=$DEFAULT_DIR
  fi

  existing=$(installed_dir)
  if [ -n "$existing" ] && [ "$existing" != "$repo_dir" ]; then
    if [ -z "$install_dir" ] && [ "$from_checkout" = 0 ] && [ -f "$existing/scripts/prod.sh" ]; then
      repo_dir=$existing
      note "SantexGo bu serverda allaqachon o'rnatilgan: $repo_dir — shu papka yangilanadi"
    else
      die "SantexGo bu serverda boshqa papkada ishlayapti: $existing. O'sha papkani yangilang: cd $existing && sudo sh scripts/install.sh"
    fi
  fi
  env_file=$repo_dir/docker/.env.production

  repo_owner=root
  repo_home=/root
  if [ -e "$repo_dir/.git" ]; then
    owner=$(stat -c %U "$repo_dir")
    if [ "$owner" != root ] && id "$owner" > /dev/null 2>&1; then
      repo_owner=$owner
      repo_home=$(getent passwd "$owner" | cut -d: -f6)
      # prod.sh root nomidan "git rev-parse" qilganda (versiya nomi uchun) boshqa foydalanuvchi
      # papkasi rad etilmasin
      export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0="$repo_dir"
    fi
    if [ -z "$branch" ] && command -v git > /dev/null 2>&1; then
      branch=$(repo_git symbolic-ref -q --short HEAD 2> /dev/null || true)
    fi
  fi
  [ -n "$branch" ] || branch=$DEFAULT_BRANCH
}

# Skript loyiha nusxasi ichidan (scripts/install.sh) ishga tushirilganmi — loyiha papkasi
script_checkout() {
  case "$0" in *install.sh) ;; *) return 1 ;; esac
  [ -f "$0" ] || return 1
  dir=$(cd "$(dirname "$0")/.." 2> /dev/null && pwd -P) || return 1
  [ -f "$dir/scripts/prod.sh" ] && [ -f "$dir/docker/docker-compose.prod.yml" ] && [ -e "$dir/.git" ] ||
    return 1
  printf '%s\n' "$dir"
}

# Sayt va admin panel domenlari. Domen bo'lmasa — bepul manzil (<IP>.sslip.io). Bepul manzildagi
# saytga qayta ishga tushirishda o'z domenini ulash mumkin; o'z domeni sozlamalar faylida bo'lsa —
# o'zgartirilmaydi (boshqa domenga o'tish: DEPLOY.md, 6.2)
collect_domains() {
  file_site=$(env_get SITE_DOMAIN)
  if [ -n "$file_site" ] && ! is_free_domain "$file_site"; then
    from_file site SITE_DOMAIN
    from_file admin_domain ADMIN_DOMAIN && return 0
    input admin_domain ADMIN_DOMAIN v_admin_domain "Admin panel domeni" "admin.$site"
    write_keys="$write_keys ADMIN_DOMAIN"
    return 0
  fi

  if [ -z "$site" ] && [ "$INTERACTIVE" = 1 ]; then
    if [ -n "$file_site" ]; then
      info "Sayt hozir bepul manzilda: https://$file_site"
      info "O'z domeningizni ulash uchun uni kiriting (oldin DNS'da @, www va admin A yozuvlarini"
      info "server IP'siga qarating — DEPLOY.md, 3-bo'lim)."
      ask "Domen (bepul manzilda qolish — Enter)"
    else
      info "Domeningiz (masalan: santexgo.uz) bo'lmasa, Enter bosing — sayt bepul manzilda ochiladi."
      info "O'z domeningizni keyin ulash mumkin: o'rnatish buyrug'ini qayta berish kifoya."
      ask "Sayt domeni (domen yo'q — Enter)"
    fi
    site=$answer
  fi
  while :; do
    if [ -z "$(trim "$site")" ]; then
      if site=$(free_domain); then break; fi
      [ "$INTERACTIVE" = 1 ] ||
        die "Serverning tashqi IP manzilini aniqlab bo'lmadi — bepul manzil berib bo'lmaydi. SITE_DOMAIN bering (masalan: santexgo.uz)"
      note "Serverning tashqi IP manzilini aniqlab bo'lmadi — bepul manzil berib bo'lmaydi"
      ask "Sayt domeni (masalan: santexgo.uz)"
      site=$answer
      continue
    fi
    if result=$(v_site_domain "$site"); then
      site=$result
      break
    fi
    [ "$INTERACTIVE" = 1 ] || die "SITE_DOMAIN: $result"
    note "$result"
    ask "Sayt domeni (domen yo'q — Enter)"
    site=$answer
  done

  if is_free_domain "$site"; then
    admin_domain=admin.$site
    if is_free_domain "$file_site" && [ "$site" != "$file_site" ]; then
      note "Server IP manzili o'zgargan — yangi bepul manzil: $site"
    fi
  else
    input admin_domain ADMIN_DOMAIN v_admin_domain "Admin panel domeni" "admin.$site"
  fi
  [ "$site" = "$file_site" ] || write_keys="$write_keys SITE_DOMAIN"
  [ "$admin_domain" = "$(env_get ADMIN_DOMAIN)" ] || write_keys="$write_keys ADMIN_DOMAIN"
}

collect_inputs() {
  # Sozlamalar faylida bor qiymatlar qayta so'ralmaydi; yo'qlari so'raladi va faylga yoziladi
  write_keys=
  collect_domains
  for key in ACME_EMAIL ESKIZ_EMAIL ESKIZ_PASSWORD; do
    case "$key" in
      ACME_EMAIL)
        from_file acme_email "$key" && continue
        input acme_email "$key" v_email "Email (HTTPS sertifikati xabarlari uchun)"
        ;;
      ESKIZ_EMAIL)
        from_file eskiz_email "$key" && continue
        if [ "$INTERACTIVE" = 1 ] && [ -z "$eskiz_email" ]; then
          info "Eskiz.uz — SMS xizmati (ro'yxatdan o'tish va parol tiklash kodlari)."
          info "Akkaunt hali yo'q bo'lsa, Enter bosing: sayt SMS'siz ishga tushadi (mijozlar"
          info "ro'yxatdan o'ta olmaydi), Eskiz'ni keyin o'rnatish buyrug'ini qayta berib ulaysiz."
        fi
        if ! input_optional eskiz_email "$key" v_email "Eskiz email (hozircha yo'q — Enter)"; then
          SMS_OFF=1
          continue
        fi
        ;;
      ESKIZ_PASSWORD)
        [ "$SMS_OFF" = 0 ] || continue
        from_file eskiz_password "$key" && continue
        input_secret eskiz_password "$key" v_file_secret "Eskiz paroli (ekranda ko'rinmaydi)"
        ;;
    esac
    write_keys="$write_keys $key"
  done
  # Eskiz bo'lmasa — SMS'siz (API production'da Eskiz'siz faqat shunday ishga tushadi)
  if [ "$SMS_OFF" = 1 ]; then sms_provider=none; else sms_provider=eskiz; fi
  [ "$(env_get SMS_PROVIDER)" = "$sms_provider" ] || write_keys="$write_keys SMS_PROVIDER"

  if from_file sample_products SEED_SAMPLE_PRODUCTS; then
    :
  else
    sample_products=${sample_products:-false}
    sample_products=$(v_bool "$sample_products") || die "SEED_SAMPLE_PRODUCTS: $sample_products"
    write_keys="$write_keys SEED_SAMPLE_PRODUCTS"
  fi

  admin=no
  if [ -f "$env_file" ]; then admin=$(admin_state); fi
  case "$admin" in
    yes)
      if [ -n "$admin_phone$admin_password" ]; then
        note "Admin akkaunt allaqachon bor — ADMIN_PHONE/ADMIN_PASSWORD ishlatilmaydi (yangi admin: sh scripts/prod.sh admin)"
      fi
      ;;
    no) input_admin ;;
    unknown)
      # Baza hozir to'xtatilgan: admin bor-yo'qligi deploy'dan keyin aniqlanadi
      if [ -n "$admin_phone$admin_password" ]; then input_admin; fi
      ;;
  esac
}

input_admin() {
  if [ "$INTERACTIVE" = 1 ] && [ -z "$admin_phone$admin_password" ]; then
    info "Admin panelga kirish uchun akkaunt (telefon raqami va parol):"
  fi
  input admin_phone ADMIN_PHONE v_phone "Admin telefon raqami (+998XXXXXXXXX)"
  input_secret admin_password ADMIN_PASSWORD v_admin_password \
    "Admin paroli — kamida $MIN_PASSWORD_LENGTH belgi (ekranda ko'rinmaydi)" confirm
}

show_summary() {
  say ""
  say "${B}Sozlamalar:${N}"
  if is_free_domain "$site"; then
    info "Sayt:           https://$site (bepul manzil)"
  else
    info "Sayt:           https://$site"
  fi
  info "Admin panel:    https://$admin_domain"
  info "Email (HTTPS):  $acme_email"
  if [ "$SMS_OFF" = 1 ]; then
    info "Eskiz SMS:      ulanmagan — keyin ulanadi (shu paytgacha mijozlar ro'yxatdan o'ta olmaydi)"
  else
    info "Eskiz SMS:      $eskiz_email (parol yashirin)"
  fi
  case "$admin" in
    yes) info "Admin:          mavjud akkaunt (o'zgartirilmaydi)" ;;
    *) if [ -n "$admin_phone" ]; then info "Admin:          $admin_phone"; fi ;;
  esac
  info "Papka:          $repo_dir ($branch)"
  if [ "$sample_products" = true ]; then
    info "Namunaviy mahsulotlar: ha (faqat sinov serveri uchun)"
  fi
}

# apt-get: boshqa o'rnatish (masalan, serverning avtomatik yangilanishi) tugashini kutadi
apt_get() {
  attempt=0
  while :; do
    if apt-get -qq -o DPkg::Lock::Timeout=120 "$@" > /dev/null 2> "$TMP_DIR/apt.log"; then
      return 0
    fi
    if grep -qi 'lock' "$TMP_DIR/apt.log" && [ "$attempt" -lt 20 ]; then
      attempt=$((attempt + 1))
      note "apt band (boshqa o'rnatish ishlayapti) — kutilmoqda..."
      sleep 15
      continue
    fi
    cat "$TMP_DIR/apt.log" >&2
    return 1
  done
}

prepare_system() {
  export DEBIAN_FRONTEND=noninteractive NEEDRESTART_SUSPEND=1
  info "Paketlar ro'yxati yangilanmoqda..."
  apt_get update || die "apt-get update bajarilmadi (xato yuqorida)"
  apt_get install -y git curl ca-certificates unattended-upgrades ||
    die "Paketlarni o'rnatib bo'lmadi (xato yuqorida)"
  ok "Paketlar: git, curl, ca-certificates, unattended-upgrades"

  # "dpkg-reconfigure -plow unattended-upgrades" → Yes bilan bir xil
  auto=/etc/apt/apt.conf.d/20auto-upgrades
  if ! grep -qs 'Unattended-Upgrade "1"' "$auto"; then
    printf '%s\n' 'APT::Periodic::Update-Package-Lists "1";' 'APT::Periodic::Unattended-Upgrade "1";' > "$auto"
  fi
  ok "Xavfsizlik yangilanishlari har kuni avtomatik o'rnatiladi (unattended-upgrades)"

  setup_swap

  # Redis xotira kam paytda ham ma'lumotni diskka ishonchli yozishi uchun
  printf '%s\n' '# SantexGo: Redis uchun (docs/DEPLOY.md, 4.7)' 'vm.overcommit_memory = 1' \
    > /etc/sysctl.d/90-redis.conf
  if sysctl -q -w vm.overcommit_memory=1 > /dev/null 2>&1; then
    ok "vm.overcommit_memory = 1 (Redis uchun)"
  else
    note "vm.overcommit_memory o'rnatilmadi — server qayta yuklanganda kuchga kiradi"
  fi
}

# Swap — build paytida xotira yetmasligining oldini oladi (RAM 4 GB va undan kam bo'lsa)
setup_swap() {
  mem_kb=$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)
  mem_gb=$(awk -v kb="$mem_kb" 'BEGIN { printf "%.1f", kb / 1048576 }')
  if [ "$mem_kb" -ge 4718592 ]; then
    ok "RAM: $mem_gb GB — swap kerak emas"
    return 0
  fi
  if [ -n "$(awk 'NR > 1' /proc/swaps)" ]; then
    ok "RAM: $mem_gb GB, swap allaqachon bor"
    return 0
  fi
  free_kb=$(df -Pk / | awk 'NR == 2 { print $4 }')
  if [ "$free_kb" -lt 12582912 ]; then
    note "Diskda joy kam — swap yaratilmadi (build paytida xotira yetmasligi mumkin)"
    return 0
  fi
  size_mb=4096
  if [ "$free_kb" -lt 26214400 ]; then size_mb=2048; fi
  created=0
  if [ ! -f /swapfile ]; then
    created=1
    info "Swap yaratilmoqda: /swapfile, $((size_mb / 1024)) GB (RAM: $mem_gb GB)..."
    if ! { fallocate -l "${size_mb}M" /swapfile 2> /dev/null && chmod 600 /swapfile && mkswap /swapfile > /dev/null 2>&1 && swapon /swapfile 2> /dev/null; }; then
      # Ba'zi fayl tizimlarida fallocate fayli swap uchun yaramaydi — dd bilan qayta
      rm -f /swapfile
      dd if=/dev/zero of=/swapfile bs=1M count="$size_mb" status=none 2> /dev/null || true
      chmod 600 /swapfile 2> /dev/null || true
      mkswap /swapfile > /dev/null 2>&1 || true
    fi
  fi
  if [ -n "$(awk 'NR > 1' /proc/swaps)" ] || swapon /swapfile 2> /dev/null; then
    grep -qs '^/swapfile[[:space:]]' /etc/fstab || printf '%s\n' '/swapfile none swap sw 0 0' >> /etc/fstab
    ok "Swap yoqildi: /swapfile ($((size_mb / 1024)) GB)"
  else
    if [ "$created" = 1 ]; then rm -f /swapfile; fi
    note "Swap yoqilmadi — build paytida xotira yetmasligi mumkin (DEPLOY.md, 4.7)"
  fi
}

# Hozir ishlayotgan SSH porti(lar)i — firewall yoqilganda ulanish uzilmasin
ssh_ports() {
  {
    if command -v sshd > /dev/null 2>&1; then
      sshd -T 2> /dev/null | awk '$1 == "port" { print $2 }'
    fi
    if command -v ss > /dev/null 2>&1; then
      ss -Htlnp 2> /dev/null | awk '/"sshd/ { n = split($4, a, ":"); print a[n] }'
    fi
    if command -v systemctl > /dev/null 2>&1; then
      systemctl show -p Listen --value ssh.socket 2> /dev/null | grep -o ':[0-9][0-9]* (Stream)' |
        tr -cd '0-9\n'
    fi
    if [ -n "${SSH_CONNECTION:-}" ]; then
      printf '%s\n' "$SSH_CONNECTION" | awk '{ print $4 }'
    fi
  } | grep -E '^[0-9]{1,5}$' | sort -nu | tr '\n' ' ' | sed 's/ *$//'
}

setup_firewall() {
  if is_yes "${SKIP_FIREWALL:-}"; then
    note "SKIP_FIREWALL=1 — firewall sozlanmadi"
    return 0
  fi
  if ! command -v ufw > /dev/null 2>&1; then
    apt_get install -y ufw || die "ufw o'rnatilmadi (xato yuqorida)"
  fi
  ports=$(ssh_ports)
  [ -n "$ports" ] || ports=22
  # Avval SSH — keyin yoqish: joriy ulanish uzilmaydi
  for port in $ports; do
    ufw allow "$port/tcp" comment 'SSH' > /dev/null
  done
  ufw allow 80/tcp comment 'SantexGo HTTP' > /dev/null
  ufw allow 443/tcp comment 'SantexGo HTTPS' > /dev/null
  ufw allow 443/udp comment 'SantexGo HTTP/3' > /dev/null
  ufw --force enable > /dev/null
  ok "Firewall (ufw) yoqildi: SSH ($ports), 80, 443 ochiq; qolgan kiruvchi ulanishlar yopiq"
  info "Provayder panelida ham firewall bo'lsa, unda ham shu portlarni oching"
}

install_docker() {
  if docker compose version > /dev/null 2>&1; then
    ok "Docker allaqachon o'rnatilgan"
  else
    info "Docker o'rnatilmoqda (rasmiy skript: get.docker.com, 1–3 daqiqa)..."
    curl -fsSL https://get.docker.com -o "$TMP_DIR/get-docker.sh" ||
      die "get.docker.com dan yuklab bo'lmadi — internet ulanishini tekshiring"
    if ! sh "$TMP_DIR/get-docker.sh" > "$TMP_DIR/docker.log" 2>&1; then
      tail -n 30 "$TMP_DIR/docker.log" >&2
      die "Docker o'rnatilmadi (xato yuqorida). Qo'lda: https://docs.docker.com/engine/install/ubuntu/"
    fi
    docker compose version > /dev/null 2>&1 ||
      die "Docker Compose plagini topilmadi. Qo'lda: https://docs.docker.com/compose/install/linux/"
  fi
  # Server qayta yuklanganda Docker (va sayt) o'zi ishga tushadi
  if command -v systemctl > /dev/null 2>&1; then
    systemctl enable --now docker > /dev/null 2>&1 || true
  fi
  docker info > /dev/null 2>&1 || die "Docker ishlamayapti. Holati: systemctl status docker"
  ok "Docker $(docker version --format '{{.Server.Version}}'), Compose $(docker compose version --short)"
}

fetch_code() {
  if [ -e "$repo_dir/.git" ]; then
    changes=$(repo_git status --porcelain --untracked-files=no) ||
      die "$repo_dir: git ishlamadi (xato yuqorida)"
    if [ -n "$changes" ]; then
      printf '%s\n' "$changes" >&2
      die "$repo_dir da o'zgartirilgan fayllar bor (yuqorida) — yangilash to'xtatildi. Ular kerak bo'lmasa, bekor qiling (cd $repo_dir && git checkout -- .) yoki dasturchiga murojaat qiling"
    fi
    before=$(repo_git rev-parse --short HEAD)
    repo_git fetch -q --prune origin ||
      die "GitHub'dan yangilab bo'lmadi — internet ulanishini va repozitoriyga kirish huquqini tekshiring"
    current=$(repo_git symbolic-ref -q --short HEAD || true)
    if [ "$current" != "$branch" ]; then
      if repo_git show-ref -q --verify "refs/heads/$branch"; then
        repo_git checkout -q "$branch" || die "$branch branch'iga o'tib bo'lmadi"
      else
        repo_git checkout -q -b "$branch" --track "origin/$branch" ||
          die "\"$branch\" branch'i topilmadi: $(repo_git remote get-url origin)"
      fi
    fi
    repo_git merge -q --ff-only "origin/$branch" ||
      die "Kodni yangilab bo'lmadi: $repo_dir dagi commit'lar GitHub'dagidan farq qiladi (dasturchiga murojaat qiling)"
    after=$(repo_git rev-parse --short HEAD)
    if [ "$before" = "$after" ]; then
      ok "Kod eng yangi holatda: $(repo_git log -1 --format='%h %s')"
    else
      ok "Kod yangilandi: $before → $(repo_git log -1 --format='%h %s')"
    fi
  else
    if [ -d "$repo_dir" ] && [ -n "$(ls -A "$repo_dir")" ]; then
      die "$repo_dir bo'sh emas va git repozitoriy emas — boshqa papka tanlang: INSTALL_DIR=/opt/santexgo2"
    fi
    info "Yuklab olinmoqda: $repo_url ($branch) → $repo_dir"
    mkdir -p "$(dirname "$repo_dir")"
    git clone -q --branch "$branch" "$repo_url" "$repo_dir" ||
      die "Kodni yuklab bo'lmadi: $repo_url ($branch)"
    ok "Kod: $(repo_git log -1 --format='%h %s')"
  fi
}

write_config() {
  if [ ! -f "$env_file" ]; then
    # Baza, Redis parollari va kalit — tasodifiy (scripts/prod.sh init)
    sh "$repo_dir/scripts/prod.sh" init "$site" "$admin_domain" "$acme_email" > /dev/null
    ok "Yaratildi: docker/.env.production (parollar va kalitlar tasodifiy)"
  fi
  for key in $write_keys; do
    case "$key" in
      SITE_DOMAIN) env_put "$key" "$site" ;;
      ADMIN_DOMAIN) env_put "$key" "$admin_domain" ;;
      ACME_EMAIL) env_put "$key" "$acme_email" ;;
      # Bittalik qo'shtirnoqda: $, # va bo'shliqlar docker compose'da o'zgarmaydi
      ESKIZ_EMAIL) env_put "$key" "'$eskiz_email'" ;;
      ESKIZ_PASSWORD) env_put "$key" "'$eskiz_password'" ;;
      SEED_SAMPLE_PRODUCTS) env_put "$key" "$sample_products" ;;
      SMS_PROVIDER) env_put "$key" "$sms_provider" ;;
    esac
  done
  { [ "$SMS_OFF" = 1 ] || [ "$(env_get ESKIZ_PASSWORD)" = "$eskiz_password" ]; } &&
    [ "$(env_get SITE_DOMAIN)" = "$site" ] && [ "$(env_get SMS_PROVIDER)" = "$sms_provider" ] ||
    die "docker/.env.production ga yozilgan qiymatlar kiritilganiga mos emas — faylni tekshiring"
  chmod 600 "$env_file"
  if [ "$repo_owner" != root ]; then chown "$repo_owner" "$env_file"; fi
  if [ -n "$write_keys" ]; then
    ok "Sozlamalar yozildi:$(printf '%s' "$write_keys" | sed 's/ /, /g; s/^,//')"
  else
    ok "Sozlamalar fayli mavjud — o'zgartirilmadi"
  fi
  info "Fayl: $env_file (faqat root o'qiy oladi — nusxasini parol menejerida saqlang)"
}

seed_and_admin() {
  if [ "$admin" = unknown ]; then admin=$(admin_state); fi
  if [ "$admin" = yes ]; then
    ok "Admin akkaunt allaqachon bor — ma'lumotnomalar va admin o'zgartirilmadi"
    return 0
  fi
  if [ -z "$admin_phone" ] || [ -z "$admin_password" ]; then
    [ "$INTERACTIVE" = 1 ] ||
      die "Admin akkaunt yo'q va ADMIN_PHONE/ADMIN_PASSWORD berilmagan. Qo'lda: cd $repo_dir && sudo sh scripts/prod.sh seed && sudo sh scripts/prod.sh admin"
    note "Bazada admin akkaunt yo'q — yaratamiz"
    input_admin
  fi
  sh "$repo_dir/scripts/prod.sh" seed || die "Ma'lumotnomalarni yozib bo'lmadi (xato yuqorida)"
  # Parol buyruq qatorida emas (jarayonlar ro'yxatida ko'rinmasin) — muhit orqali
  ADMIN_PHONE=$admin_phone ADMIN_PASSWORD=$admin_password sh "$repo_dir/scripts/prod.sh" admin ||
    die "Admin akkaunt yaratilmadi (xato yuqorida)"
}

finish() {
  insecure=
  case "$site" in *.localhost) insecure=-k ;; esac
  # shellcheck disable=SC2086 # insecure bo'sh bo'lishi mumkin
  if curl -fsS $insecure --max-time 10 -o /dev/null --resolve "$site:443:127.0.0.1" \
    "https://$site/api/health" 2> /dev/null; then
    https_line="${G}✔${N} HTTPS ishlayapti"
  else
    https_line="${Y}!${N} HTTPS hali ochilmayapti — DNS va portlarni tekshiring (DEPLOY.md, 10-bo'lim); sertifikatni Caddy o'zi qayta urinib oladi"
  fi

  say ""
  say "${G}${B}✔ SantexGo ishga tushdi!${N} (jami: $(elapsed))"
  say ""
  info "Sayt:          https://$site"
  info "Admin panel:   https://$admin_domain"
  if [ -n "$admin_phone" ] && [ "$admin" != yes ]; then
    info "Admin login:   $admin_phone (parol — o'rnatishda kiritilgan)"
  fi
  info "$https_line"
  if is_free_domain "$site"; then
    say ""
    note "Sayt bepul manzilda. O'z domeningizni ulash: DNS'da @, www va admin A yozuvlarini"
    info "  server IP'siga qarating va o'rnatish buyrug'ini qayta bering — domen so'raladi."
  fi
  if [ "$SMS_OFF" = 1 ]; then
    say ""
    note "SMS ulanmagan: mijozlar ro'yxatdan o'ta olmaydi, shuning uchun buyurtma ham bera olmaydi."
    info "  Eskiz.uz akkaunti ochilgach, o'rnatish buyrug'ini qayta bering — Eskiz so'raladi."
  fi
  say ""
  say "${B}Keyingi qadamlar:${N}"
  info "1. Admin panelga kiring: Sozlamalar, Brendlar, Mahsulotlar (DEPLOY.md, 5.6)"
  if [ "$SMS_OFF" = 1 ]; then
    info "2. Eskiz.uz akkaunti oching va SMS matnlarini shablon sifatida tasdiqlating (DEPLOY.md, 5.2)"
  else
    info "2. Eskiz kabinetida SMS matnlarini shablon sifatida tasdiqlating (DEPLOY.md, 5.2)"
  fi
  info "3. Zaxira nusxalarni serverdan tashqariga ko'chirishni sozlang (DEPLOY.md, 7.3)"
  info "4. Tashqi monitoring sozlang (DEPLOY.md, 8.4)"
  say ""
  say "${B}Boshqarish${N} (loyiha papkasi: $repo_dir):"
  info "cd $repo_dir"
  info "sudo sh scripts/prod.sh status     xizmatlar holati"
  info "sudo sh scripts/prod.sh logs       loglar (chiqish: Ctrl + C)"
  info "sudo sh scripts/prod.sh            barcha buyruqlar"
  say ""
  say "${B}Yangilash:${N} o'rnatish buyrug'ini qayta bering (sozlamalar so'ralmaydi) yoki:"
  info "cd $repo_dir && sudo git pull && sudo sh scripts/prod.sh deploy"
  if [ -f /var/run/reboot-required ]; then
    say ""
    note "Tizim yangilanishlari serverni qayta yuklashni talab qilyapti — mijozlar kam paytda:"
    info "  sudo reboot   (sayt o'zi qayta ishga tushadi)"
  fi
  say "Qo'llanma: $DOCS_URL"
}

# Skriptni qayta ishga tushirish buyrug'i (fayldan yoki "curl | sudo sh" bilan)
rerun_command() {
  if [ -f "$0" ]; then
    printf 'sudo sh %s' "$0"
  else
    printf 'curl -fsSL %s | sudo sh' "$INSTALL_URL"
  fi
}

on_exit() {
  status=$?
  restore_echo
  if [ -n "$TMP_DIR" ]; then rm -rf "$TMP_DIR"; fi
  if [ "$status" -ne 0 ] && [ "$STEP" -ge 3 ]; then
    printf '\n%s✖ %s: [%s/%s] %s (%s)%s\n' "$R" "O'rnatish to'xtadi" \
      "$STEP" "$TOTAL_STEPS" "$STEP_TITLE" "$(elapsed)" "$N" >&2
    printf '  %s\n' \
      "Xato sababi yuqorida. Tuzatib, o'rnatishni qayta ishga tushiring — bu xavfsiz:" \
      "  $(rerun_command)" \
      "Xizmatlar loglari: cd $repo_dir && sudo sh scripts/prod.sh logs" \
      "Muammolar va yechimlar: $DOCS_URL (10-bo'lim)" >&2
  fi
  exit "$status"
}

usage() {
  cat <<EOF
Foydalanish: sudo sh install.sh   (yoki: curl -fsSL $INSTALL_URL | sudo sh)

SantexGo'ni serverga o'rnatadi yoki o'rnatilganini yangilaydi. Argumentlar yo'q — qiymatlar
so'raladi yoki muhit o'zgaruvchilaridan olinadi: SITE_DOMAIN, ADMIN_DOMAIN, ACME_EMAIL,
ESKIZ_EMAIL, ESKIZ_PASSWORD, ADMIN_PHONE, ADMIN_PASSWORD, INSTALL_DIR, SANTEXGO_REPO,
SANTEXGO_BRANCH, SEED_SAMPLE_PRODUCTS, SKIP_FIREWALL=1, SKIP_DNS_CHECK=1.
Domen bo'lmasa — bepul manzil (<server IP>.sslip.io); Eskiz bo'lmasa — SMS'siz. Ikkalasini ham
keyin ulash mumkin: buyruqni qayta bering.
Qo'llanma: $DOCS_URL
EOF
}

main() {
  case "${1:-}" in
    "") ;;
    -h | --help | help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      die "Noma'lum argument: $1"
      ;;
  esac
  START=$(date +%s)
  trap on_exit EXIT
  trap 'exit 130' INT TERM HUP

  say "${B}SantexGo — serverga o'rnatish${N}"
  say "Sayt, admin panel, API, baza va zaxira nusxalar shu serverga HTTPS bilan o'rnatiladi:"
  info "• avval bir nechta savol: domen, email, Eskiz SMS, admin akkaunt (1–2 daqiqa;"
  info "  domen va Eskiz bo'lmasa — Enter, keyin ulanadi);"
  info "• keyin hammasi avtomatik (15–40 daqiqa): tizim yangilanishlari, swap, firewall,"
  info "  Docker, kod, build va ishga tushirish."
  say "Domen bo'lsa: uning A yozuvlari (@, www, admin) shu server IP'siga qaratilgan bo'lsin."
  say "Qayta ishga tushirish xavfsiz — o'rnatilgan serverni yangilaydi."
  say ""

  [ "$(id -u)" = 0 ] || die "Root huquqi kerak — sudo bilan ishga tushiring: $(rerun_command)"
  # Savollar terminaldan o'qiladi (stdin — "curl | sh" da skriptning o'zi); terminal bo'lmasa
  # (CI, avtomatlashtirish) — so'rovsiz rejim: qiymatlar faqat muhit o'zgaruvchilaridan
  if (: < /dev/tty) 2> /dev/null; then INTERACTIVE=1; fi
  TMP_DIR=$(mktemp -d)

  # Kiritilgan qiymatlar ichki o'zgaruvchilarga olinadi va muhitdan o'chiriladi: docker compose
  # muhitdagi o'zgaruvchini docker/.env.production dagidan ustun qo'yadi
  site=${SITE_DOMAIN:-}
  admin_domain=${ADMIN_DOMAIN:-}
  acme_email=${ACME_EMAIL:-}
  eskiz_email=${ESKIZ_EMAIL:-}
  eskiz_password=${ESKIZ_PASSWORD:-}
  admin_phone=${ADMIN_PHONE:-}
  admin_password=${ADMIN_PASSWORD:-}
  sample_products=${SEED_SAMPLE_PRODUCTS:-}
  unset SITE_DOMAIN ADMIN_DOMAIN ACME_EMAIL ESKIZ_EMAIL ESKIZ_PASSWORD ADMIN_PHONE ADMIN_PASSWORD \
    SEED_SAMPLE_PRODUCTS
  install_dir=${INSTALL_DIR:-}
  repo_url=${SANTEXGO_REPO:-$DEFAULT_REPO}
  branch=${SANTEXGO_BRANCH:-}

  check_system
  locate_repo
  if [ ! -f "$env_file" ] && has_database; then
    die "Serverda SantexGo bazasi bor, lekin sozlamalar fayli yo'q: $env_file. Eski faylni (parol menejeridagi nusxani) shu joyga tiklang va qayta ishga tushiring — yangi parollar bilan baza ochilmaydi"
  fi

  step "Sozlamalar"
  collect_inputs
  if [ ! -f "$env_file" ]; then
    mode_label="yangi o'rnatish"
  elif [ "$admin" = no ]; then
    mode_label="o'rnatishni davom ettirish"
  else
    mode_label="yangilash (SantexGo allaqachon o'rnatilgan)"
  fi
  ok "Rejim: $mode_label"

  step "DNS tekshiruvi"
  check_dns
  show_summary
  if [ "$ASKED" = 1 ]; then
    confirm "Boshlaymizmi?" || die "Bekor qilindi — hech narsa o'zgartirilmadi"
  fi
  say ""
  say "Endi hammasi avtomatik — terminalni yopmang (ulanish uzilsa, buyruqni qayta bering)."

  step "Tizim: paketlar, xavfsizlik yangilanishlari, swap"
  prepare_system

  step "Firewall"
  setup_firewall

  step "Docker"
  install_docker

  step "Kod"
  fetch_code

  step "Sozlamalar fayli"
  write_config

  step "Build va ishga tushirish"
  info "Birinchi marta 10–30 daqiqa (server kuchiga qarab), keyingi yangilashlar tezroq"
  sh "$repo_dir/scripts/prod.sh" deploy || die "Build yoki ishga tushirish muvaffaqiyatsiz (xato yuqorida)"

  step "Ma'lumotnomalar va admin akkaunt"
  seed_and_admin

  finish
  exit 0
}

# Butun skript bitta funksiyada: "curl | sh" da skript to'liq o'qilgandan keyingina ishga tushadi.
# stdin — /dev/null: hech bir buyruq skript matnini o'qib yubormaydi (savollar /dev/tty dan).
# SANTEXGO_INSTALL_SOURCE_ONLY=1 — faqat funksiyalarni yuklash (sinov uchun)
if [ "${SANTEXGO_INSTALL_SOURCE_ONLY:-}" != 1 ]; then
  main "$@" < /dev/null
fi
