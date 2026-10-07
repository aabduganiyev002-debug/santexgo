#!/usr/bin/env node
/**
 * SantexGo — loyihani kompyuterda ishga tushirishga tayyorlaydi.
 *
 *   pnpm setup:local               odatiy usul (Docker bilan)
 *   pnpm setup:local --no-docker   PostgreSQL kompyuterga alohida o'rnatilgan bo'lsa
 *
 * Nima qiladi:
 *   1. Node.js, pnpm va Docker borligini tekshiradi
 *   2. .env fayllarini tasodifiy xavfsiz parollar bilan yaratadi (mavjud fayllarga tegmaydi)
 *   3. Bog'liqliklarni o'rnatadi
 *   4. PostgreSQL, Redis, Meilisearch va S3 xizmatlarini Docker'da ishga tushiradi
 *   5. Bazaga migratsiyalarni qo'llaydi
 *   6. Namunaviy katalog va admin akkauntni yozadi
 *
 * Qayta ishga tushirish xavfsiz. Kod yangilangandan keyin (GitHub'dan Pull) ham shu buyruqni
 * bering: yangi bog'liqliklar o'rnatiladi va yangi migratsiyalar qo'llanadi.
 *
 * Faqat Node.js'ning o'z modullaridan foydalanadi — "pnpm install" dan oldin ham ishlaydi.
 */
import { execSync, spawnSync } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

const ROOT = path.resolve(import.meta.dirname, '..');
const ROOT_ENV = path.join(ROOT, '.env');
const ROOT_ENV_EXAMPLE = path.join(ROOT, '.env.example');
const API_ENV = path.join(ROOT, 'apps', 'api', '.env');
const API_ENV_EXAMPLE = path.join(ROOT, 'apps', 'api', '.env.example');
const COMPOSE = 'docker compose --env-file .env -f docker/docker-compose.yml';
const MIN_NODE = { major: 22, minor: 12 };
const PNPM_INSTALL_HINT =
  'pnpm o‘rnating: npm install -g pnpm@10.28.0  (Mac’da boshiga sudo qo‘shing)';

const useDocker = !process.argv.includes('--no-docker');
const TOTAL_STEPS = 6;

// ────────────────────────────── Chiqish formati ──────────────────────────────

const colorEnabled = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (colorEnabled ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = paint('1');
const dim = paint('2');
const green = paint('32');
const yellow = paint('33');
const red = paint('31');
const cyan = paint('36');

let currentStep = 0;
function step(title) {
  currentStep += 1;
  console.log(`\n${bold(`[${currentStep}/${TOTAL_STEPS}] ${title}`)}`);
}
const ok = (message) => console.log(`  ${green('✔')} ${message}`);
const note = (message) => console.log(`  ${yellow('!')} ${message}`);

class SetupError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

/** Buyruqni ekranga chiqarib bajaradi. Xato bo'lsa, maslahat bilan SetupError tashlaydi. */
function run(command, hint) {
  console.log(dim(`  $ ${command}`));
  try {
    execSync(command, { cwd: ROOT, stdio: 'inherit' });
  } catch {
    throw new SetupError(`Buyruq bajarilmadi: ${command}`, hint);
  }
}

/** Buyruqni jimgina bajarib, natijasini qaytaradi; xato bo'lsa null. */
function capture(command) {
  try {
    return execSync(command, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

// ──────────────────────────────── Tekshiruvlar ────────────────────────────────

function checkTools() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < MIN_NODE.major || (major === MIN_NODE.major && minor < MIN_NODE.minor)) {
    throw new SetupError(
      `Node.js ${process.versions.node} juda eski (kamida ${MIN_NODE.major}.${MIN_NODE.minor} kerak).`,
      'nodejs.org saytidan Node.js 24 LTS versiyasini o‘rnating va terminalni qayta oching.',
    );
  }
  ok(`Node.js ${process.versions.node}`);

  const pnpmVersion = capture('pnpm --version');
  if (!pnpmVersion) throw new SetupError('pnpm topilmadi.', PNPM_INSTALL_HINT);
  ok(`pnpm ${pnpmVersion}`);

  if (!useDocker) {
    note('Docker tekshiruvi o‘tkazib yuborildi (--no-docker)');
    return;
  }
  const dockerVersion = spawnSync('docker', ['--version'], { encoding: 'utf8' });
  if (dockerVersion.error || dockerVersion.status !== 0) {
    throw new SetupError(
      'Docker topilmadi.',
      'docker.com saytidan Docker Desktop dasturini o‘rnating, oching va qayta urinib ko‘ring.',
    );
  }
  if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
    throw new SetupError(
      'Docker ishlamayapti.',
      'Docker Desktop dasturini oching va u to‘liq ishga tushishini kuting (pastda yashil ' +
        '"Engine running" yozuvi chiqadi). Keyin buyruqni qayta bering.',
    );
  }
  if (spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' }).status !== 0) {
    throw new SetupError(
      'Docker Compose topilmadi.',
      'Docker Desktop’ning yangi versiyasini o‘rnating.',
    );
  }
  ok(dockerVersion.stdout.trim());
}

// ─────────────────────────────── .env fayllari ───────────────────────────────

const secret = (bytes = 16) => randomBytes(bytes).toString('hex');

/** Adashtiradigan belgilarsiz (0/O, 1/l/I) o'qish va yozish oson parol. */
function readablePassword(length = 14) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
}

/** Namunadagi KEY=... qatorlarini berilgan qiymatlar bilan almashtiradi. */
function fillTemplate(templatePath, values) {
  let content = readFileSync(templatePath, 'utf8');
  for (const [key, value] of Object.entries(values)) {
    const line = new RegExp(`^${key}=.*$`, 'm');
    if (!line.test(content)) throw new Error(`${path.basename(templatePath)} da ${key} topilmadi`);
    content = content.replace(line, () => `${key}=${value}`);
  }
  return content;
}

function readEnv(file) {
  return parseEnv(readFileSync(file, 'utf8'));
}

function redisUrlFrom(infra) {
  if (!useDocker || !infra.REDIS_PASSWORD) return '';
  const port = infra.REDIS_PORT || '6379';
  return `redis://:${encodeURIComponent(infra.REDIS_PASSWORD)}@127.0.0.1:${port}`;
}

/**
 * Mavjud .env fayliga yangi bosqichlarda qo'shilgan sozlamalarni qo'shadi.
 * Foydalanuvchi o'zgartirgan qiymatlarga tegilmaydi: faqat yo'q yoki bo'sh kalitlar to'ldiriladi.
 */
function addMissingKeys(file, values) {
  let content = readFileSync(file, 'utf8');
  const current = parseEnv(content);
  const added = [];
  const appended = [];
  for (const [key, value] of Object.entries(values)) {
    if (current[key]) continue;
    const line = new RegExp(`^${key}=.*$`, 'm');
    if (line.test(content)) {
      if (!value) continue;
      content = content.replace(line, () => `${key}=${value}`);
    } else {
      appended.push(`${key}=${value}`);
    }
    added.push(key);
  }
  if (appended.length > 0) {
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const separator = content.endsWith('\n') ? '' : eol;
    content += `${separator}${eol}# Yangi sozlamalar (pnpm setup:local qo'shdi)${eol}${appended.join(eol)}${eol}`;
  }
  if (added.length > 0) writeFileSync(file, content);
  return added;
}

function databaseUrlFrom(infra) {
  const user = encodeURIComponent(infra.POSTGRES_USER || 'santexgo');
  const password = encodeURIComponent(infra.POSTGRES_PASSWORD);
  const name = encodeURIComponent(infra.POSTGRES_DB || 'santexgo');
  const port = infra.POSTGRES_PORT || '5432';
  return `postgresql://${user}:${password}@127.0.0.1:${port}/${name}`;
}

function ensureEnvFiles() {
  const result = { adminPassword: null, adminPhone: null };

  if (existsSync(ROOT_ENV)) {
    ok('.env mavjud — o‘zgartirilmadi');
  } else {
    writeFileSync(
      ROOT_ENV,
      fillTemplate(ROOT_ENV_EXAMPLE, {
        POSTGRES_PASSWORD: secret(),
        REDIS_PASSWORD: secret(),
        MEILI_MASTER_KEY: secret(),
      }),
    );
    ok('.env yaratildi (baza, Redis va qidiruv uchun tasodifiy parollar bilan)');
  }

  const infra = readEnv(ROOT_ENV);
  if (!infra.POSTGRES_PASSWORD) {
    throw new SetupError(
      '.env faylida POSTGRES_PASSWORD yo‘q.',
      '.env faylini o‘chiring — buyruq uni qayta yaratadi (lokal baza bo‘lsa, avval: pnpm infra:reset).',
    );
  }

  if (existsSync(API_ENV)) {
    const added = addMissingKeys(API_ENV, {
      AUTH_SECRET: secret(32),
      REDIS_URL: redisUrlFrom(infra),
      SMS_PROVIDER: 'console',
    });
    if (added.length > 0) {
      ok(`apps/api/.env ga yangi sozlamalar qo‘shildi: ${added.join(', ')}`);
    } else {
      ok('apps/api/.env mavjud — o‘zgartirilmadi');
    }
    checkDatabaseUrl(readEnv(API_ENV), infra);
  } else {
    result.adminPassword = readablePassword();
    writeFileSync(
      API_ENV,
      fillTemplate(API_ENV_EXAMPLE, {
        DATABASE_URL: databaseUrlFrom(infra),
        ADMIN_PASSWORD: result.adminPassword,
        AUTH_SECRET: secret(32),
        REDIS_URL: redisUrlFrom(infra),
      }),
    );
    result.adminPhone = readEnv(API_ENV).ADMIN_PHONE ?? null;
    ok('apps/api/.env yaratildi');
  }
  return result;
}

/** Docker bazasining paroli va porti API sozlamasidagi bilan bir xil ekanini tekshiradi. */
function checkDatabaseUrl(api, infra) {
  if (!useDocker) return;
  let url;
  try {
    url = new URL(api.DATABASE_URL ?? '');
  } catch {
    note('apps/api/.env dagi DATABASE_URL noto‘g‘ri yozilgan.');
    return;
  }
  const samePassword = decodeURIComponent(url.password) === infra.POSTGRES_PASSWORD;
  const samePort = (url.port || '5432') === String(infra.POSTGRES_PORT || '5432');
  if (!samePassword || !samePort) {
    note(
      'apps/api/.env dagi DATABASE_URL ildizdagi .env ga mos emas (parol yoki port). ' +
        'To‘g‘ri qiymat:\n    DATABASE_URL=' +
        databaseUrlFrom(infra),
    );
  }
}

// ──────────────────────────────── Asosiy oqim ────────────────────────────────

function main() {
  console.log(bold(cyan('\nSantexGo — kompyuterda ishga tushirishga tayyorlash')));

  step('Kerakli dasturlarni tekshirish');
  checkTools();

  step('Sozlamalar (.env fayllari)');
  const env = ensureEnvFiles();

  step('Bog‘liqliklarni o‘rnatish (birinchi marta bir necha daqiqa)');
  run('pnpm install', 'Internet ulanishini tekshiring va buyruqni qayta bering.');

  step('Baza va xizmatlarni ishga tushirish');
  if (useDocker) {
    run(
      `${COMPOSE} up -d --wait --wait-timeout 300`,
      'Docker Desktop ochiq va internet bor ekanini tekshiring. "port is already allocated" ' +
        'xatosi chiqsa, kompyuterda boshqa PostgreSQL ishlayapti: .env da POSTGRES_PORT=5433 ' +
        'qiling va apps/api/.env dagi DATABASE_URL portini ham 5433 ga o‘zgartiring.',
    );
    ok('PostgreSQL, Redis, Meilisearch va S3 ishlayapti');
  } else {
    note(
      'O‘tkazib yuborildi (--no-docker): baza apps/api/.env dagi DATABASE_URL bo‘yicha ishlatiladi',
    );
  }

  step('Baza tuzilmasini yaratish (migratsiyalar)');
  run(
    'pnpm db:deploy',
    'Baza ishlayotganini va apps/api/.env dagi DATABASE_URL to‘g‘riligini tekshiring. Parol ' +
      'xatosi chiqsa va .env ni qayta yaratgan bo‘lsangiz: pnpm infra:reset, keyin pnpm setup:local',
  );

  step('Namunaviy katalog va admin akkaunt');
  run(
    'pnpm db:seed',
    'Yuqoridagi xato matnini o‘qing; tushunarsiz bo‘lsa, uni Claude’ga yuboring.',
  );

  console.log(`\n${green(bold('✔ Hammasi tayyor!'))}\n`);
  console.log(`  API’ni ishga tushirish:  ${bold('pnpm dev')}`);
  console.log(`  So‘ng brauzerda oching:  ${cyan('http://localhost:4000/api/docs')}`);
  console.log(
    `  Bazani ko‘rish:          ${bold('pnpm db:studio')}  →  ${cyan('http://localhost:5555')}`,
  );
  if (env.adminPassword) {
    console.log(`\n  Admin akkaunt (admin panel tayyor bo‘lganda kerak bo‘ladi):`);
    console.log(`    Telefon: ${env.adminPhone ?? '+998901234567'}`);
    console.log(`    Parol:   ${bold(env.adminPassword)}`);
    console.log(dim('    Ikkalasi ham apps/api/.env faylida saqlangan.'));
  }
  console.log('');
}

try {
  main();
} catch (error) {
  if (error instanceof SetupError) {
    console.error(`\n${red(bold('✖ ' + error.message))}`);
    if (error.hint) console.error(`  ${yellow('Nima qilish kerak:')} ${error.hint}\n`);
  } else {
    console.error(`\n${red(bold('✖ Kutilmagan xato:'))}`, error);
  }
  process.exitCode = 1;
}
