/**
 * Production image uchun (Dockerfile'dagi prod-deps bosqichi): `pnpm install --prod` dan keyin
 * runtime'da kerak bo'lmagan paketlarni node_modules/.pnpm dan o'chiradi.
 *
 * Sabab: @prisma/client `prisma` CLI va `typescript` ni ixtiyoriy peer sifatida e'lon qiladi.
 * Workspace'da ular bor bo'lgani uchun pnpm ularni production o'rnatishga ham qo'shadi —
 * Prisma Studio, migratsiya dvigateli, PGlite va TypeScript (~400 MB). API ularni ishlatmaydi:
 * migratsiyalar alohida "migrate" konteynerida bajariladi.
 *
 * Usul: shu peer havolalari uziladi, so'ng loyiha paketlaridan (importer'lardan) havolalar
 * bo'yicha yetib bo'lmaydigan har bir paket o'chiriladi. Ishlatish: node prune-runtime-deps.mjs <ildiz>
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const store = path.join(root, 'node_modules', '.pnpm');
const OPTIONAL_PEERS = ['prisma', 'typescript'];
const IMPORTERS = ['node_modules', 'apps/api/node_modules', 'packages/shared/node_modules'];

/** node_modules ichidagi paket papkalari (scope'lilari bilan): @a/b, c */
function packageDirs(nodeModules) {
  if (!fs.existsSync(nodeModules)) return [];
  const result = [];
  for (const name of fs.readdirSync(nodeModules)) {
    if (name === '.pnpm' || name === '.bin' || name.startsWith('.')) continue;
    const full = path.join(nodeModules, name);
    if (name.startsWith('@')) {
      for (const sub of fs.readdirSync(full)) result.push(path.join(full, sub));
    } else {
      result.push(full);
    }
  }
  return result;
}

/** Paket papkasi qaysi store yozuviga tegishli: ".pnpm/<yozuv>/node_modules/..." → <yozuv> */
function storeEntryOf(dir) {
  let real;
  try {
    real = fs.realpathSync(dir);
  } catch {
    return null; // uzilgan havola
  }
  const relative = path.relative(store, real);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return relative.split(path.sep)[0];
}

// 1. @prisma/client yonidagi ixtiyoriy peer havolalarini uzish
for (const entry of fs.readdirSync(store)) {
  if (!entry.startsWith('@prisma+client@')) continue;
  for (const peer of OPTIONAL_PEERS) {
    fs.rmSync(path.join(store, entry, 'node_modules', peer), { force: true });
  }
}

// 2. Importer'lardan boshlab havolalar bo'yicha yetib boriladigan store yozuvlari
const reachable = new Set();
const queue = IMPORTERS.flatMap((dir) => packageDirs(path.join(root, dir)));
while (queue.length > 0) {
  const entry = storeEntryOf(queue.pop());
  if (!entry || reachable.has(entry)) continue;
  reachable.add(entry);
  queue.push(...packageDirs(path.join(store, entry, 'node_modules')));
}

// 3. Qolganlarini o'chirish
let removed = 0;
for (const entry of fs.readdirSync(store)) {
  if (entry === 'node_modules' || entry.startsWith('.') || reachable.has(entry)) continue;
  fs.rmSync(path.join(store, entry), { recursive: true, force: true });
  removed += 1;
}

// 4. .pnpm/node_modules dagi (hoist qilingan) endi uzilgan havolalarni tozalash
for (const dir of packageDirs(path.join(store, 'node_modules'))) {
  if (storeEntryOf(dir) === null) fs.rmSync(dir, { force: true });
}

console.info(
  `Runtime'da kerak bo'lmagan paketlar o'chirildi: ${removed}, qoldi: ${reachable.size}`,
);
