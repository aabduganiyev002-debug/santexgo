/**
 * Bazaga ulanishdagi keng tarqalgan xatolar uchun tushunarli maslahat.
 * Prisma (pg driver adapter) xatosining tuzilishiga tayanadi: error.meta.driverAdapterError.cause.
 */

interface DriverAdapterCause {
  kind?: string;
  host?: string;
  port?: number;
  db?: string;
  originalMessage?: string;
}

function readCause(error: unknown): DriverAdapterCause | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const meta = (error as { meta?: unknown }).meta;
  if (typeof meta !== 'object' || meta === null) return undefined;
  const adapterError = (meta as { driverAdapterError?: unknown }).driverAdapterError;
  if (typeof adapterError !== 'object' || adapterError === null) return undefined;
  const cause = (adapterError as { cause?: unknown }).cause;
  return typeof cause === 'object' && cause !== null ? (cause as DriverAdapterCause) : undefined;
}

function readCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** Xato tanish bo'lsa, nima qilish kerakligini aytadigan matn qaytaradi; aks holda null. */
export function dbErrorHint(error: unknown): string | null {
  const cause = readCause(error);
  switch (cause?.kind) {
    case 'DatabaseNotReachable': {
      const target = cause.host ? ` (${cause.host}:${cause.port ?? ''})` : '';
      return (
        `PostgreSQL bazasiga ulanib bo'lmadi${target}. ` +
        `Docker Desktop ochiq ekanini tekshiring va "pnpm infra:up" buyrug'ini bajaring.`
      );
    }
    case 'AuthenticationFailed':
      return (
        "Bazaga kirish paroli noto'g'ri. apps/api/.env dagi DATABASE_URL paroli ildizdagi " +
        ".env dagi POSTGRES_PASSWORD bilan bir xil bo'lishi kerak. Agar .env faylini qayta " +
        'yaratgan bo\'lsangiz, lokal baza eski parol bilan qolgan: "pnpm infra:reset" ' +
        '(lokal ma\'lumotlar o\'chadi), keyin "pnpm setup:local".'
      );
    case 'DatabaseDoesNotExist':
      return (
        `"${cause.db ?? ''}" nomli baza topilmadi. DATABASE_URL dagi baza nomi ildizdagi ` +
        `.env dagi POSTGRES_DB bilan bir xil ekanini tekshiring.`
      );
  }
  // P2021: jadval mavjud emas — migratsiyalar hali qo'llanmagan
  if (readCode(error) === 'P2021') {
    return 'Baza jadvallari hali yaratilmagan. "pnpm db:deploy" buyrug\'ini bajaring.';
  }
  return null;
}
