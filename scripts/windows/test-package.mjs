// Windows paketi sinovi (CI): ZIP ochilgan papkada foydalanuvchi kabi SantexGo.bat ni ishga tushiradi,
// sayt, admin panel, API, rasm yuklash va SMS kodni tekshiradi, admin telefon raqami va parolini
// saytda o'zgartiradi, SantexGo-toxtatish.bat bilan to'xtatadi; keyin ikkinchi marta (baza va
// ma'lumotlar saqlangan holda) ishga tushiradi: eski parol ko'rsatilmaydi, yangisi bilan kiriladi.
// Uchinchi marta Admin-sozlash.bat: raqam va parol oynada so'raladi, keyin SantexGo ishga tushadi.
//   node scripts/windows/test-package.mjs <ZIP ochilgan SantexGo papkasi>
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const DIR = path.resolve(process.argv[2] ?? '');
const IS_WIN = process.platform === 'win32';
const LOG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'santexgo-sinov-'));
const SITE = 'http://127.0.0.1:3000';
const ADMIN = 'http://127.0.0.1:3001';
const API = 'http://127.0.0.1:4000';
const PORTS = [3000, 3001, 4000, 54329];
const NEW_ADMIN = { phone: '+998901112255', password: 'Yangi-admin-parol-1' };
// Admin-sozlash.bat ga foydalanuvchi kabi yoziladi (avval noto'g'ri raqam va qisqa parol)
const SETUP_ADMIN = {
  input: '123\n93 555 44 33\nqisqa\nSinov2026ok\n',
  phone: '+998935554433',
  shown: '+998 93 555 44 33',
  password: 'Sinov2026ok',
};
// 16x16 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR42mO46SFPEmIY1TCqYfhqAADZxkAQ7D8XygAAAABJRU5ErkJggg==',
  'base64',
);

const ok = (text) => console.log(`✔ ${text}`);
function fail(text) {
  throw new Error(text);
}

/** Windows'da — .bat fayl (foydalanuvchi kabi); boshqa tizimda (lokal sinov) — launcher'ning o'zi */
function bat(name, action) {
  if (IS_WIN) return ['cmd.exe', ['/d', '/c', name]];
  return [
    path.join(DIR, 'app', 'node', 'node'),
    [path.join(DIR, 'app', 'launcher', 'launcher.mjs'), action],
  ];
}

const env = { ...process.env, SANTEXGO_NO_BROWSER: '1', SANTEXGO_NO_PAUSE: '1' };

function readLog(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

async function start(run, { file = 'SantexGo.bat', action = 'start', input } = {}) {
  const logFile = path.join(LOG_DIR, `ishga-tushirish-${run}.log`);
  const out = fs.openSync(logFile, 'w');
  const [command, args] = bat(file, action);
  const child = spawn(command, args, {
    cwd: DIR,
    env,
    stdio: [input ? 'pipe' : 'ignore', out, out],
    windowsHide: true,
  });
  if (input) child.stdin.end(input);
  let exited = null;
  child.on('exit', (code) => (exited = code ?? -1));
  const startedAt = Date.now();
  const deadline = startedAt + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const text = readLog(logFile);
    if (text.includes('SantexGo ishlayapti')) {
      ok(`${run}-ishga tushirish: ${Math.round((Date.now() - startedAt) / 1000)} soniya`);
      return { child, logFile, isExited: () => exited !== null };
    }
    if (exited !== null || text.includes('XATO')) {
      console.log(text);
      fail(`${run}-ishga tushirish muvaffaqiyatsiz (kod ${exited})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  console.log(readLog(logFile));
  fail(`${run}-ishga tushirish: 10 daqiqada tayyor bo'lmadi`);
}

async function request(url, { method = 'GET', headers = {}, body, cookies } = {}) {
  const response = await fetch(url, {
    method,
    headers: { ...headers, ...(cookies ? { cookie: cookies } : {}) },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(120_000),
  });
  return response;
}

async function expectStatus(label, status, url, options) {
  const response = await request(url, options);
  if (response.status !== status) {
    fail(
      `${label}: ${response.status} (kutilgan ${status}) — ${(await response.text()).slice(0, 300)}`,
    );
  }
  return response;
}

async function expectText(label, url, needle) {
  const response = await expectStatus(label, 200, url);
  const text = await response.text();
  if (!text.includes(needle)) fail(`${label}: sahifada "${needle}" yo'q`);
  ok(`${label}: ${url}`);
}

function portOpen(port) {
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

async function stop(run, started) {
  const [command, args] = bat('SantexGo-toxtatish.bat', 'stop');
  const result = spawnSync(command, args, { cwd: DIR, env, encoding: 'utf8', windowsHide: true });
  console.log(result.stdout.trim());
  if (result.status !== 0) fail(`To'xtatish: kod ${result.status}\n${result.stderr}`);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const open = [];
    for (const port of PORTS) if (await portOpen(port)) open.push(port);
    if (open.length === 0 && started.isExited()) {
      ok(`${run}-to'xtatish: portlar bo'sh, baza to'xtadi`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  fail(`${run}-to'xtatish: portlar hali band yoki SantexGo.bat oynasi yopilmadi`);
}

async function checkEverything(started) {
  const health = await (await expectStatus('API', 200, `${API}/api/health`)).json();
  if (health.status !== 'ok') fail(`API holati: ${JSON.stringify(health)}`);
  ok('API, baza: ishlayapti');

  await expectText('Bosh sahifa', `${SITE}/`, 'SantexGo');
  await expectText('Katalog', `${SITE}/catalog/trubalar?material=ppr`, 'PPR');
  await expectText(
    'Mahsulot sahifasi',
    `${SITE}/products/plastherm-ppr-truba-d25-pn20-4-m`,
    'PLT-PPR-PN20-25',
  );
  await expectText('Admin kirish sahifasi', `${ADMIN}/login`, 'SantexGo Admin');

  // Admin akkaunt: paket o'zi yaratgan, ma'lumotlari data/settings.json da (ADMIN-KIRISH.txt da ham)
  const settings = JSON.parse(fs.readFileSync(path.join(DIR, 'data', 'settings.json'), 'utf8'));
  const adminFile = fs.readFileSync(path.join(DIR, 'ADMIN-KIRISH.txt'), 'utf8');
  if (!adminFile.includes(settings.adminPassword)) fail("ADMIN-KIRISH.txt da parol yo'q");
  const login = await expectStatus('Admin sifatida kirish', 200, `${ADMIN}/api/v1/auth/login`, {
    method: 'POST',
    headers: { origin: 'http://localhost:3001', 'content-type': 'application/json' },
    body: JSON.stringify({ phone: settings.adminPhone, password: settings.adminPassword }),
  });
  const { user } = await login.json();
  if (user?.role !== 'ADMIN') fail(`Kirgan foydalanuvchi admin emas: ${user?.role}`);
  const cookies = login.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
  await expectStatus('Admin statistika', 200, `${ADMIN}/api/v1/admin/stats/overview`, { cookies });
  ok('Admin panel: kirish va statistika');

  // Rasm yuklash: PNG → WebP (sharp Windows'da ishlaydi)
  const list = await (
    await expectStatus('Mahsulotlar (admin)', 200, `${ADMIN}/api/v1/admin/products?pageSize=1`, {
      cookies,
    })
  ).json();
  const productId = list.items?.[0]?.id ?? fail("Admin: mahsulotlar ro'yxati bo'sh");
  const product = await (
    await expectStatus('Mahsulot (admin)', 200, `${ADMIN}/api/v1/admin/products/${productId}`, {
      cookies,
    })
  ).json();
  const before = new Set(product.images.map((item) => item.id));
  const form = new FormData();
  form.append('files', new Blob([PNG], { type: 'image/png' }), 'sinov.png');
  const uploaded = await (
    await expectStatus('Rasm yuklash', 201, `${ADMIN}/api/v1/admin/products/${productId}/images`, {
      method: 'POST',
      headers: { origin: 'http://localhost:3001' },
      body: form,
      cookies,
    })
  ).json();
  const image =
    uploaded.find((item) => !before.has(item.id)) ?? fail("Rasm yuklash: javobda yangi rasm yo'q");
  const media = await expectStatus('Yuklangan rasm', 200, `${SITE}${image.medium}`);
  if (!media.headers.get('content-type')?.includes('image/webp')) fail('Yuklangan rasm WebP emas');
  await expectStatus(
    "Rasmni o'chirish",
    200,
    `${ADMIN}/api/v1/admin/products/${productId}/images/${image.id}`,
    {
      method: 'DELETE',
      headers: { origin: 'http://localhost:3001' },
      cookies,
    },
  );
  ok("Rasm yuklash: PNG → WebP, saytda ochiladi, o'chiriladi");

  // SMS kod: kompyuterda yuborilmaydi — oynada ko'rsatiladi
  await expectStatus("SMS kod so'rash", 200, `${SITE}/api/v1/auth/register/send-code`, {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '+998901112244' }),
  });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  if (
    !readLog(started.logFile).includes("SMS (yuborilmadi, shu yerda ko'rsatiladi): +998901112244")
  ) {
    fail("SMS kod oynada ko'rsatilmadi");
  }
  ok("SMS kod oynada ko'rsatildi");

  await changeAdminLogin(started, settings, cookies);
}

/** Foydalanuvchi kabi: saytdagi "Profil va xavfsizlik" — yangi raqam (SMS kod oynada) va parol */
async function changeAdminLogin(started, settings, cookies) {
  const headers = { origin: 'http://localhost:3000', 'content-type': 'application/json' };
  await expectStatus('Yangi raqamga SMS kod', 200, `${SITE}/api/v1/account/phone/send-code`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone: NEW_ADMIN.phone }),
    cookies,
  });
  let code = null;
  const deadline = Date.now() + 15_000;
  while (!code && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const line = readLog(started.logFile)
      .split(/\r?\n/)
      .find((text) => text.includes(`ko'rsatiladi): ${NEW_ADMIN.phone}`));
    code = line?.match(/kodi (\d+)/)?.[1] ?? null;
  }
  if (!code) fail("Yangi raqam uchun SMS kod oynada ko'rsatilmadi");
  const user = await (
    await expectStatus('Yangi raqamni tasdiqlash', 200, `${SITE}/api/v1/account/phone`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone: NEW_ADMIN.phone, code }),
      cookies,
    })
  ).json();
  if (user.phone !== NEW_ADMIN.phone) fail(`Telefon raqami o'zgarmadi: ${user.phone}`);
  await expectStatus("Parolni o'zgartirish", 204, `${SITE}/api/v1/account/password`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      currentPassword: settings.adminPassword,
      password: NEW_ADMIN.password,
      passwordConfirm: NEW_ADMIN.password,
    }),
    cookies,
  });
  ok("Admin telefon raqami va paroli saytda o'zgartirildi");
}

/** Ikkinchi ishga tushirish: eski parol hech qayerda ko'rsatilmaydi, yangisi bilan kiriladi */
async function checkChangedAdminLogin(started) {
  const settings = JSON.parse(fs.readFileSync(path.join(DIR, 'data', 'settings.json'), 'utf8'));
  const adminFile = fs.readFileSync(path.join(DIR, 'ADMIN-KIRISH.txt'), 'utf8');
  if (readLog(started.logFile).includes(settings.adminPassword)) {
    fail("Oynada eski (o'zgartirilgan) admin paroli ko'rsatildi");
  }
  if (adminFile.includes(settings.adminPassword) || !adminFile.includes("o'zgartirilgan")) {
    fail(`ADMIN-KIRISH.txt yangilanmagan:\n${adminFile}`);
  }
  const login = await expectStatus('Yangi login bilan kirish', 200, `${ADMIN}/api/v1/auth/login`, {
    method: 'POST',
    headers: { origin: 'http://localhost:3001', 'content-type': 'application/json' },
    body: JSON.stringify(NEW_ADMIN),
  });
  const { user } = await login.json();
  if (user?.role !== 'ADMIN') fail(`Kirgan foydalanuvchi admin emas: ${user?.role}`);
  ok("O'zgartirilgan admin login: eski parol ko'rsatilmaydi, yangisi bilan kiriladi");
}

/** Admin-sozlash.bat: noto'g'ri javoblar qayta so'raladi, yangi login o'rnatiladi, eskisi ishlamaydi */
async function checkSetupAdmin(started) {
  const log = readLog(started.logFile);
  if (!log.includes("Raqam noto'g'ri") || !log.includes('Parol kamida 8 belgidan')) {
    fail("Admin-sozlash: noto'g'ri raqam yoki qisqa parol qayta so'ralmadi");
  }
  if (!log.includes(`Admin login:  ${SETUP_ADMIN.shown}   parol: ${SETUP_ADMIN.password}`)) {
    fail("Admin-sozlash: oynada yangi admin login ko'rsatilmadi");
  }
  const adminFile = fs.readFileSync(path.join(DIR, 'ADMIN-KIRISH.txt'), 'utf8');
  if (!adminFile.includes(SETUP_ADMIN.shown) || !adminFile.includes(SETUP_ADMIN.password)) {
    fail(`ADMIN-KIRISH.txt yangilanmagan:\n${adminFile}`);
  }
  const headers = { origin: 'http://localhost:3001', 'content-type': 'application/json' };
  const login = await expectStatus(
    'Admin-sozlash: yangi login',
    200,
    `${ADMIN}/api/v1/auth/login`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone: SETUP_ADMIN.phone, password: SETUP_ADMIN.password }),
    },
  );
  const { user } = await login.json();
  if (user?.role !== 'ADMIN') fail(`Kirgan foydalanuvchi admin emas: ${user?.role}`);
  await expectStatus('Admin-sozlash: eski login', 401, `${ADMIN}/api/v1/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify(NEW_ADMIN),
  });
  ok("Admin-sozlash.bat: raqam va parol o'rnatildi, eski login endi ishlamaydi");
}

function printLogs() {
  for (const file of fs.readdirSync(LOG_DIR)) {
    console.log(`\n── ${file} ──\n${readLog(path.join(LOG_DIR, file))}`);
  }
  const dataLogs = path.join(DIR, 'data', 'logs');
  if (fs.existsSync(dataLogs)) {
    for (const file of fs.readdirSync(dataLogs)) {
      const text = readLog(path.join(dataLogs, file)).split(/\r?\n/).slice(-80).join('\n');
      console.log(`\n── data/logs/${file} (oxiri) ──\n${text}`);
    }
  }
}

try {
  if (!fs.existsSync(path.join(DIR, 'SantexGo.bat'))) fail(`SantexGo.bat topilmadi: ${DIR}`);
  const first = await start(1);
  await checkEverything(first);
  await stop(1, first);

  const second = await start(2);
  if (readLog(second.logFile).includes("Boshlang'ich ma'lumotlar yozildi")) {
    fail('Ikkinchi ishga tushirishda seed qayta bajarildi');
  }
  await checkChangedAdminLogin(second);
  await expectText(
    'Ikkinchi marta: mahsulot sahifasi',
    `${SITE}/products/plastherm-ppr-truba-d25-pn20-4-m`,
    'PLT-PPR-PN20-25',
  );
  await stop(2, second);

  const third = await start(3, {
    file: 'Admin-sozlash.bat',
    action: 'admin',
    input: SETUP_ADMIN.input,
  });
  await checkSetupAdmin(third);
  await stop(3, third);
  console.log('\n✔ Windows paketi sinovi muvaffaqiyatli');
} catch (error) {
  console.error(`\n✖ ${error.message}`);
  printLogs();
  // Sinovdan keyin hech narsa ishlab qolmasin
  const [command, args] = bat('SantexGo-toxtatish.bat', 'stop');
  spawnSync(command, args, { cwd: DIR, env, stdio: 'inherit', windowsHide: true });
  process.exit(1);
}
