// SantexGo — Windows uchun tayyor paket: baza, API, sayt va admin panelni bitta oynada ishga tushiradi.
// Hech narsa o'rnatish shart emas — Node.js va PostgreSQL paketning ichida.
//
// Paket tuzilishi (scripts/windows/build-package.mjs yig'adi):
//   SantexGo.bat, SantexGo-toxtatish.bat, YORIQNOMA.txt
//   app/node        — Node.js           app/pgsql — PostgreSQL (bin, lib, share)
//   app/api         — API (build + bog'liqliklar, migratsiyalar, seed)
//   app/web         — sayt (Next.js standalone)    app/admin — admin panel
//   app/launcher    — shu fayl
//   data/           — birinchi ishga tushirishda yaratiladi: baza, rasmlar, loglar, sozlamalar
//
// Buyruqlar: node launcher.mjs start | stop
// Sinov (CI) uchun: SANTEXGO_NO_BROWSER=1 — brauzer ochilmaydi
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const IS_WIN = process.platform === 'win32';
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const APP = path.join(ROOT, 'app');
const API_DIR = path.join(APP, 'api');
const DATA = path.join(ROOT, 'data');
const LOGS = path.join(DATA, 'logs');
const PGDATA = path.join(DATA, 'pgdata');
const UPLOADS = path.join(DATA, 'uploads');
const SETTINGS_FILE = path.join(DATA, 'settings.json');
const RUN_FILE = path.join(DATA, 'run.json');
const ADMIN_FILE = path.join(ROOT, 'ADMIN-KIRISH.txt');
const PG_BIN = path.join(APP, 'pgsql', 'bin');
const NODE = process.execPath;

const DB = { host: '127.0.0.1', port: 54329, user: 'santexgo', name: 'santexgo' };
const PORTS = { web: 3000, admin: 3001, api: 4000 };
const SITE_URL = `http://localhost:${PORTS.web}`;
const ADMIN_URL = `http://localhost:${PORTS.admin}`;
const API_URL = `http://127.0.0.1:${PORTS.api}`;
// Paketdagi sayt shu manzil bilan build qilingan (NEXT_PUBLIC_SITE_URL)
const LOCAL_ORIGINS = [
  SITE_URL,
  ADMIN_URL,
  `http://127.0.0.1:${PORTS.web}`,
  `http://127.0.0.1:${PORTS.admin}`,
];
const DEFAULT_ADMIN_PHONE = '+998901234567';

// ─────────────────────────────── Chiqish ───────────────────────────────

const say = (text = '') => console.log(text);
const info = (text) => console.log(`  ${text}`);
const ok = (text) => console.log(`  OK: ${text}`);

class LaunchError extends Error {}
const fail = (message) => {
  throw new LaunchError(message);
};

// ─────────────────────────────── Yordamchilar ───────────────────────────────

const exe = (name) => path.join(PG_BIN, IS_WIN ? `${name}.exe` : name);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

/** Buyruqni bajaradi; xato bo'lsa — chiqishining oxiri bilan LaunchError */
function run(command, args, { cwd = ROOT, env = process.env, what } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail(`${what ?? path.basename(command)}: ${result.error.message}`);
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split(/\r?\n/).slice(-25);
    fail(
      `${what ?? path.basename(command)} xato bilan tugadi (kod ${result.status}):\n${output.join('\n')}`,
    );
  }
  return result.stdout ?? '';
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** Portda biror dastur tinglayaptimi (ulanib ko'rish) */
function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(1500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

async function responds(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'manual' });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitFor(url, seconds, isDead) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (isDead?.()) return false;
    if (await responds(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function openBrowser(url) {
  if (process.env.SANTEXGO_NO_BROWSER === '1') return;
  try {
    const child = IS_WIN
      ? spawn('cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`], {
          windowsVerbatimArguments: true,
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        })
      : spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Brauzer ochilmasa — manzil ekranda yozilgan
  }
}

function killTree(pid) {
  if (!isAlive(pid)) return;
  if (IS_WIN) {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // allaqachon to'xtagan
    }
  }
}

// ─────────────────────────────── Sozlamalar ───────────────────────────────

/** Admin uchun o'qishga oson parol (chalkash belgilarsiz: 0/O, 1/l/I) */
function readablePassword(length = 12) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
}

function loadSettings() {
  const saved = readJson(SETTINGS_FILE);
  if (saved?.dbPassword && saved.authSecret && saved.adminPhone && saved.adminPassword)
    return saved;
  const settings = {
    dbPassword: randomBytes(16).toString('hex'),
    authSecret: randomBytes(32).toString('hex'),
    adminPhone: DEFAULT_ADMIN_PHONE,
    adminPassword: readablePassword(),
    seeded: false,
  };
  writeJson(SETTINGS_FILE, settings);
  return settings;
}

function formatPhone(phone) {
  const d = phone.replace(/\D/g, '');
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}

function writeAdminFile(settings) {
  const lines = [
    'SantexGo - admin panelga kirish',
    '',
    `Admin panel: ${ADMIN_URL}`,
    `Telefon:     ${formatPhone(settings.adminPhone)}`,
    `Parol:       ${settings.adminPassword}`,
    '',
    `Sayt:        ${SITE_URL}`,
    '',
    'Bu fayl faqat shu kompyuterdagi sinov nusxasi uchun. Uni boshqalarga bermang.',
  ];
  fs.writeFileSync(ADMIN_FILE, `${lines.join('\r\n')}\r\n`);
}

// ─────────────────────────────── PostgreSQL ───────────────────────────────

function pgEnv(settings) {
  return { ...process.env, PGPASSWORD: settings.dbPassword, PGCONNECT_TIMEOUT: '5' };
}

function postgresRunning() {
  if (!fs.existsSync(path.join(PGDATA, 'PG_VERSION'))) return false;
  const result = spawnSync(exe('pg_ctl'), ['status', '-D', PGDATA], {
    stdio: 'ignore',
    windowsHide: true,
  });
  return result.status === 0;
}

function initDatabase(settings) {
  say('');
  info('Birinchi ishga tushirish: baza yaratilmoqda (1-2 daqiqa)...');
  const pwfile = path.join(DATA, '.pgpass-init');
  fs.writeFileSync(pwfile, `${settings.dbPassword}\n`, { mode: 0o600 });
  try {
    run(
      exe('initdb'),
      [
        '-D',
        PGDATA,
        '-U',
        DB.user,
        '-E',
        'UTF8',
        '--no-locale',
        '-A',
        'scram-sha-256',
        `--pwfile=${pwfile}`,
      ],
      { what: 'Baza yaratish (initdb)' },
    );
  } catch (error) {
    // Yarim yaratilgan papka keyingi urinishga xalaqit bermasin
    fs.rmSync(PGDATA, { recursive: true, force: true });
    throw error;
  } finally {
    fs.rmSync(pwfile, { force: true });
  }
  ok('Baza yaratildi');
}

function startPostgres(settings) {
  if (postgresRunning()) {
    ok('Baza allaqachon ishlayapti');
    return;
  }
  // pg_ctl chiqishi faylga: Windows'da baza jarayoni ochiq qolgan quvurlarni (pipe) meros oladi
  // va spawnSync baza to'xtaguncha kutib qolardi
  const logFile = path.join(LOGS, 'pg_ctl.log');
  const out = fs.openSync(logFile, 'a');
  let result;
  try {
    result = spawnSync(
      exe('pg_ctl'),
      [
        'start',
        '-D',
        PGDATA,
        '-l',
        path.join(LOGS, 'postgres.log'),
        '-w',
        '-t',
        '90',
        '-o',
        // Faqat TCP (127.0.0.1): unix socket papkasi kerak emas
        `-p ${DB.port} -c listen_addresses=${DB.host} -c unix_socket_directories=`,
      ],
      { env: pgEnv(settings), stdio: ['ignore', out, out], windowsHide: true },
    );
  } finally {
    fs.closeSync(out);
  }
  if (result.error || result.status !== 0) {
    printLogTail(logFile, 10);
    printLogTail(path.join(LOGS, 'postgres.log'), 15);
    fail(`Bazani ishga tushirib bo'lmadi (pg_ctl). Loglar: ${LOGS}`);
  }
  ok('Baza ishga tushdi');
}

function stopPostgres() {
  if (!postgresRunning()) return;
  spawnSync(exe('pg_ctl'), ['stop', '-D', PGDATA, '-m', 'fast', '-w', '-t', '30'], {
    stdio: 'ignore',
    windowsHide: true,
  });
}

function ensureDatabase(settings) {
  const connection = ['-h', DB.host, '-p', String(DB.port), '-U', DB.user];
  const exists = run(
    exe('psql'),
    [
      ...connection,
      '-d',
      'postgres',
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname = '${DB.name}'`,
    ],
    { env: pgEnv(settings), what: 'Bazani tekshirish (psql)' },
  ).trim();
  if (exists !== '1') {
    run(exe('createdb'), [...connection, DB.name], { env: pgEnv(settings), what: 'createdb' });
  }
}

// ─────────────────────────────── Ilova ───────────────────────────────

function databaseUrl(settings) {
  return `postgresql://${DB.user}:${settings.dbPassword}@${DB.host}:${DB.port}/${DB.name}`;
}

function apiEnv(settings) {
  return {
    ...process.env,
    // Kompyuterdagi sinov nusxasi: SMS kodlar yuborilmaydi — shu oynada chiqadi
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: String(PORTS.api),
    DATABASE_URL: databaseUrl(settings),
    AUTH_SECRET: settings.authSecret,
    CORS_ORIGINS: LOCAL_ORIGINS.join(','),
    COOKIE_SECURE: 'false',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: UPLOADS,
    MEDIA_PUBLIC_URL: '/api/media',
    SMS_PROVIDER: 'console',
    APP_TIMEZONE: 'Asia/Tashkent',
    REDIS_URL: '',
    SWAGGER_ENABLED: 'false',
    CHECKPOINT_DISABLE: '1',
    PRISMA_HIDE_UPDATE_MESSAGE: '1',
  };
}

function migrate(settings) {
  info('Baza tuzilishi yangilanmoqda (migratsiyalar)...');
  run(
    NODE,
    [path.join(API_DIR, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
    {
      cwd: API_DIR,
      env: apiEnv(settings),
      what: 'Migratsiyalar (prisma migrate deploy)',
    },
  );
  ok('Baza tuzilishi tayyor');
}

function seed(settings) {
  if (settings.seeded) return;
  info('Katalog, namunaviy mahsulotlar va admin akkaunt yozilmoqda...');
  run(NODE, [path.join(API_DIR, 'dist-seed', 'prisma', 'seed.js')], {
    cwd: API_DIR,
    env: {
      ...apiEnv(settings),
      SEED_SAMPLE_PRODUCTS: 'true',
      ADMIN_PHONE: settings.adminPhone,
      ADMIN_PASSWORD: settings.adminPassword,
    },
    what: "Boshlang'ich ma'lumotlar (seed)",
  });
  settings.seeded = true;
  writeJson(SETTINGS_FILE, settings);
  ok("Boshlang'ich ma'lumotlar yozildi");
}

// ─────────────────────────────── Xizmatlar ───────────────────────────────

const services = [];
let stopping = false;

// Terminal rang kodlari (API logida) — ekranga va qidiruvga xalaqit bermasin
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;

function startService(name, script, cwd, env, onLine) {
  const logFile = path.join(LOGS, `${name}.log`);
  const out = fs.openSync(logFile, 'a');
  const child = spawn(NODE, [script], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const service = { name, child, logFile, exited: false };
  let buffer = '';
  const onData = (chunk) => {
    fs.writeSync(out, chunk);
    if (!onLine) return;
    buffer += chunk.toString('utf8');
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) onLine(line.replace(ANSI, ''));
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('error', (error) => {
    service.exited = true;
    if (!stopping) console.error(`  ! ${name} ishga tushmadi: ${error.message}`);
  });
  // Fayl chiqish oqimlari yopilgandan keyin yopiladi (exit'dan keyin ham ma'lumot kelishi mumkin)
  child.on('close', () => fs.closeSync(out));
  child.on('exit', (code) => {
    service.exited = true;
    if (stopping) return;
    console.error(`\n  ! ${name} kutilmaganda to'xtadi (kod ${code}). Log: ${logFile}`);
    printLogTail(logFile);
    void shutdown(1);
  });
  services.push(service);
  return service;
}

function printLogTail(file, lines = 20) {
  try {
    const tail = fs
      .readFileSync(file, 'utf8')
      .replace(ANSI, '')
      .trim()
      .split(/\r?\n/)
      .slice(-lines);
    for (const line of tail) console.error(`    ${line}`);
  } catch {
    // log yo'q
  }
}

/** API logidagi SMS kodlarni ko'rsatish (kompyuterda SMS yuborilmaydi) */
function showSms(line) {
  const index = line.indexOf('📱');
  if (index === -1) return;
  say(`\n  SMS (yuborilmadi, shu yerda ko'rsatiladi): ${line.slice(index + 2).trim()}\n`);
}

async function shutdown(code) {
  if (stopping) return;
  stopping = true;
  say("\n  SantexGo to'xtatilmoqda...");
  for (const service of services) killTree(service.child.pid);
  stopPostgres();
  fs.rmSync(RUN_FILE, { force: true });
  say("  To'xtatildi.");
  process.exit(code);
}

// ─────────────────────────────── Buyruqlar ───────────────────────────────

async function alreadyRunning() {
  const state = readJson(RUN_FILE);
  if (!state) return false;
  if (isAlive(state.launcherPid) && (await responds(`${API_URL}/api/health`))) return true;
  fs.rmSync(RUN_FILE, { force: true });
  return false;
}

function checkLocation() {
  // PostgreSQL lotin bo'lmagan harfli yoki juda uzun yo'lda ishlamasligi mumkin
  if (/[^\x20-\x7E]/.test(ROOT)) {
    fail(
      `Papka nomida lotin bo'lmagan harflar bor: ${ROOT}\n` +
        "    SantexGo papkasini C:\\SantexGo ga ko'chiring va qayta ishga tushiring.",
    );
  }
  for (const file of [NODE, exe('pg_ctl'), path.join(API_DIR, 'dist', 'main.js')]) {
    if (!fs.existsSync(file)) {
      fail(
        `Paket to'liq emas: ${file} yo'q. ZIP faylni to'liq oching (Extract All) va qayta urining.`,
      );
    }
  }
}

async function start() {
  say('');
  say('  ==============================================');
  say('    SantexGo - kompyuterda ishga tushirish');
  say('  ==============================================');
  checkLocation();
  for (const dir of [DATA, LOGS, UPLOADS]) fs.mkdirSync(dir, { recursive: true });

  if (await alreadyRunning()) {
    say('');
    ok('SantexGo allaqachon ishlayapti - sayt va admin panel brauzerda ochiladi.');
    openBrowser(SITE_URL);
    openBrowser(ADMIN_URL);
    return;
  }

  // Portlar bo'sh bo'lishi kerak (masalan, SantexGo'ning boshqa nusxasi ishlamasin)
  const busy = [];
  for (const port of [PORTS.web, PORTS.admin, PORTS.api]) {
    if (await portInUse(port)) busy.push(port);
  }
  if (busy.length > 0) {
    fail(
      `Port band: ${busy.join(', ')} - boshqa dastur ishlatyapti (masalan, SantexGo'ning boshqa\n` +
        "    nusxasi yoki 'pnpm dev'). Uni yoping yoki kompyuterni qayta ishga tushiring.",
    );
  }

  const settings = loadSettings();
  if (!fs.existsSync(path.join(PGDATA, 'PG_VERSION'))) initDatabase(settings);
  startPostgres(settings);
  ensureDatabase(settings);
  migrate(settings);
  seed(settings);
  writeAdminFile(settings);

  info('Sayt, admin panel va API ishga tushirilmoqda...');
  const api = startService(
    'api',
    path.join(API_DIR, 'dist', 'main.js'),
    API_DIR,
    apiEnv(settings),
    showSms,
  );
  const nextEnv = (port) => ({
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    API_INTERNAL_URL: API_URL,
    NEXT_TELEMETRY_DISABLED: '1',
  });
  if (!(await waitFor(`${API_URL}/api/health`, 120, () => api.exited))) {
    fail(`API ishga tushmadi. Log: ${api.logFile}`);
  }
  const web = startService(
    'sayt',
    path.join(APP, 'web', 'apps', 'web', 'server.js'),
    path.join(APP, 'web', 'apps', 'web'),
    nextEnv(PORTS.web),
  );
  const admin = startService(
    'admin',
    path.join(APP, 'admin', 'apps', 'admin', 'server.js'),
    path.join(APP, 'admin', 'apps', 'admin'),
    nextEnv(PORTS.admin),
  );
  const ready = await Promise.all([
    waitFor(`http://127.0.0.1:${PORTS.web}/`, 120, () => web.exited),
    waitFor(`http://127.0.0.1:${PORTS.admin}/login`, 120, () => admin.exited),
  ]);
  if (!ready.every(Boolean)) fail(`Sayt yoki admin panel ishga tushmadi. Loglar: ${LOGS}`);

  writeJson(RUN_FILE, {
    launcherPid: process.pid,
    pids: services.map((service) => service.child.pid),
    startedAt: new Date().toISOString(),
  });

  say('');
  say('  ==================================================================');
  say('   SantexGo ishlayapti!');
  say('');
  say(`   Sayt:         ${SITE_URL}`);
  say(`   Admin panel:  ${ADMIN_URL}`);
  say(`   Admin login:  ${formatPhone(settings.adminPhone)}   parol: ${settings.adminPassword}`);
  say(`                 (ADMIN-KIRISH.txt faylida ham yozilgan)`);
  say('');
  say("   SMS kodlar (ro'yxatdan o'tish, parol tiklash) shu oynada chiqadi -");
  say('   kompyuterdagi nusxada haqiqiy SMS yuborilmaydi.');
  say('');
  say("   To'xtatish: shu oynani yoping (yoki SantexGo-toxtatish.bat).");
  say('  ==================================================================');
  openBrowser(SITE_URL);
  openBrowser(ADMIN_URL);
}

function stop() {
  const state = readJson(RUN_FILE);
  if (state) {
    killTree(state.launcherPid);
    for (const pid of state.pids ?? []) killTree(pid);
  }
  const wasRunning = postgresRunning();
  stopPostgres();
  fs.rmSync(RUN_FILE, { force: true });
  say(state || wasRunning ? "  SantexGo to'xtatildi." : '  SantexGo ishlamayotgan edi.');
}

// ─────────────────────────────── Ishga tushirish ───────────────────────────────

const command = process.argv[2] ?? 'start';
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(signal, () => void shutdown(0));
}

try {
  if (command === 'stop') {
    stop();
  } else if (command === 'start') {
    await start();
  } else {
    fail(`Noma'lum buyruq: ${command} (start | stop)`);
  }
} catch (error) {
  const message = error instanceof LaunchError ? error.message : (error?.stack ?? String(error));
  console.error(`\n  XATO: ${message}\n`);
  console.error("  Muammo hal bo'lmasa, shu oynadagi matnni to'liq nusxalab yuboring.");
  if (command === 'start') {
    await shutdown(1);
  }
  process.exit(1);
}
