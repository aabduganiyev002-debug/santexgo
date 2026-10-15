// SantexGo Windows paketini yig'ish (GitHub Actions, windows-latest: .github/workflows/windows-package.yml).
// Oldin: hoisted bog'liqliklar bilan build (API, sayt, admin), seed kompilyatsiyasi va API uchun
// "pnpm deploy --prod". Natija: <out>/SantexGo papkasi — ZIP qilib tarqatiladi.
//
//   node scripts/windows/build-package.mjs --out <papka> --api-deploy <papka> --pg-root <papka>
//
// Paketda symlink bo'lmasligi kerak (Windows'dagi ZIP ochish ularni tiklamaydi) — hamma narsa
// haqiqiy fayl sifatida nusxalanadi.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const IS_WIN = process.platform === 'win32';
// ZIP Windows Explorer'da "Downloads\SantexGo-Windows\" kabi papkaga ochilganda ham yo'llar
// 260 belgidan oshmasligi uchun paket ichidagi eng uzun nisbiy yo'l chegarasi
const MAX_RELATIVE_PATH = 170;

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    'api-deploy': { type: 'string' },
    'pg-root': { type: 'string' },
    node: { type: 'string', default: process.execPath },
  },
});
for (const name of ['out', 'api-deploy', 'pg-root']) {
  if (!values[name]) throw new Error(`--${name} berilmagan`);
}

const OUT = path.resolve(values.out, 'SantexGo');
const APP = path.join(OUT, 'app');

function copy(from, to, filter) {
  if (!fs.existsSync(from)) throw new Error(`Topilmadi: ${from}`);
  fs.cpSync(from, to, {
    recursive: true,
    dereference: true,
    filter: filter
      ? (source) => filter(path.relative(from, source).split(path.sep).join('/'))
      : undefined,
  });
}

const step = (text) => console.log(`▸ ${text}`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(APP, { recursive: true });

// ── Ishga tushirish fayllari ──
step('Ishga tushirish fayllari');
for (const file of ['SantexGo.bat', 'SantexGo-toxtatish.bat', 'YORIQNOMA.txt']) {
  fs.copyFileSync(path.join(REPO, 'scripts', 'windows', 'package', file), path.join(OUT, file));
}
fs.mkdirSync(path.join(APP, 'launcher'));
fs.copyFileSync(
  path.join(REPO, 'scripts', 'windows', 'launcher.mjs'),
  path.join(APP, 'launcher', 'launcher.mjs'),
);

// ── Node.js ──
step(`Node.js ${process.version}`);
fs.mkdirSync(path.join(APP, 'node'));
fs.copyFileSync(values.node, path.join(APP, 'node', IS_WIN ? 'node.exe' : 'node'));

// ── PostgreSQL: faqat ishlashi uchun keraklisi (hujjatlar, pgAdmin, sarlavhalarsiz) ──
step(`PostgreSQL: ${values['pg-root']}`);
const pgSkip =
  /(^|\/)(doc|include|symbols|pgAdmin[^/]*|StackBuilder|stackbuilder[^/]*)(\/|$)|\.(pdb|lib|a|pc)$/i;
for (const dir of ['bin', 'lib', 'share']) {
  copy(path.join(values['pg-root'], dir), path.join(APP, 'pgsql', dir), (rel) => !pgSkip.test(rel));
}
if (IS_WIN) {
  // Visual C++ runtime — toza Windows'da bo'lmasligi mumkin (Microsoft ruxsat bergan "app-local" usul)
  for (const dll of ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll']) {
    const source = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', dll);
    const target = path.join(APP, 'pgsql', 'bin', dll);
    if (fs.existsSync(source) && !fs.existsSync(target)) fs.copyFileSync(source, target);
  }
}

// Ishlash uchun kerak bo'lmagan fayllar: TypeScript tiplari, source map'lar, .bin havolalari.
// Tiplar ayniqsa uzun yo'llarda (masalan, @aws-sdk/*/dist-types/...) — Windows 260 belgi chegarasi
const devOnly = /\.d\.[cm]?ts$|\.map$|(^|\/)(dist-types|node_modules\/\.bin)(\/|$)/;

// ── API: build, migratsiyalar, seed va production bog'liqliklar ──
step('API');
const apiSkip =
  /^(src|test|docker|uploads|\.turbo)(\/|$)|^(Dockerfile|nest-cli\.json|vitest[^/]*|tsconfig[^/]*\.json)$/;
copy(
  values['api-deploy'],
  path.join(APP, 'api'),
  (rel) => !apiSkip.test(rel) && !devOnly.test(rel),
);
const seedSource = path.join(REPO, 'apps', 'api', 'dist-seed');
if (!fs.existsSync(path.join(APP, 'api', 'dist-seed')))
  copy(seedSource, path.join(APP, 'api', 'dist-seed'));

// ── Sayt va admin panel: Next.js standalone ──
for (const name of ['web', 'admin']) {
  step(name === 'web' ? 'Sayt' : 'Admin panel');
  const source = path.join(REPO, 'apps', name);
  const target = path.join(APP, name);
  copy(path.join(source, '.next', 'standalone'), target, (rel) => !devOnly.test(rel));
  copy(path.join(source, '.next', 'static'), path.join(target, 'apps', name, '.next', 'static'));
  if (fs.existsSync(path.join(source, 'public'))) {
    copy(path.join(source, 'public'), path.join(target, 'apps', name, 'public'));
  }
}

// ── Versiya va litsenziyalar ──
let commit = 'local';
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: REPO,
    encoding: 'utf8',
  }).trim();
} catch {
  // git yo'q — "local"
}
const version = `${new Date().toISOString().slice(0, 10)}-${commit}`;
fs.writeFileSync(
  path.join(APP, 'VERSION.txt'),
  `SantexGo ${version}\r\nNode.js ${process.version}\r\n`,
);
fs.writeFileSync(
  path.join(APP, 'LITSENZIYALAR.txt'),
  [
    'Paket tarkibidagi dasturlar va ularning litsenziyalari:',
    '- Node.js (MIT): https://github.com/nodejs/node/blob/main/LICENSE',
    '- PostgreSQL (PostgreSQL License): https://www.postgresql.org/about/licence/',
    '- Microsoft Visual C++ Runtime (qayta tarqatiladigan fayllar)',
    '- npm paketlari: har birining litsenziyasi node_modules ichida, paket papkasida',
    '',
  ].join('\r\n'),
);

// ── Tekshiruv: kerakli fayllar bor, symlink yo'q, yo'llar uzun emas ──
step('Tekshiruv');
const ext = IS_WIN ? '.exe' : '';
const required = [
  `app/node/node${ext}`,
  ...['initdb', 'pg_ctl', 'postgres', 'psql', 'createdb'].map(
    (bin) => `app/pgsql/bin/${bin}${ext}`,
  ),
  'app/api/dist/main.js',
  'app/api/dist-seed/prisma/seed.js',
  'app/api/prisma/schema.prisma',
  'app/api/prisma.config.ts',
  'app/api/node_modules/prisma/build/index.js',
  'app/api/node_modules/@santexgo/shared/dist/index.js',
  'app/web/apps/web/server.js',
  'app/web/apps/web/.next/static',
  'app/admin/apps/admin/server.js',
  'app/admin/apps/admin/.next/static',
];
const missing = required.filter((rel) => !fs.existsSync(path.join(OUT, rel)));
const engines = path.join(APP, 'api', 'node_modules', '@prisma', 'engines');
if (!fs.readdirSync(engines).some((file) => file.startsWith('schema-engine'))) {
  missing.push('app/api/node_modules/@prisma/engines/schema-engine*');
}
if (missing.length > 0) throw new Error(`Paketda yo'q:\n  ${missing.join('\n  ')}`);

let files = 0;
let bytes = 0;
let longest = '';
for (const entry of fs.readdirSync(OUT, { recursive: true, withFileTypes: true })) {
  const full = path.join(entry.parentPath, entry.name);
  if (entry.isSymbolicLink()) throw new Error(`Paketda symlink qoldi: ${full}`);
  const rel = path.relative(path.dirname(OUT), full);
  if (rel.length > longest.length) longest = rel;
  if (entry.isFile()) {
    files += 1;
    bytes += fs.statSync(full).size;
  }
}
console.log(`  Fayllar: ${files}, hajmi: ${(bytes / 1024 / 1024).toFixed(0)} MB`);
console.log(`  Eng uzun yo'l (${longest.length}): ${longest}`);
if (longest.length > MAX_RELATIVE_PATH) {
  throw new Error(
    `Paket ichidagi yo'l juda uzun (${longest.length} > ${MAX_RELATIVE_PATH}): ${longest}`,
  );
}
console.log(`✔ Paket tayyor: ${OUT} (${version})`);
