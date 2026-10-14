import { AUTH_HINT_COOKIE_NAMES } from '@santexgo/shared';
import { nextWithCsp } from '@santexgo/ui/csp';
import { type NextRequest, NextResponse } from 'next/server';

/** Kirmasdan ham ochiladigan sahifa va fayllar (kirish sahifasi va uning ikonkasi) */
const PUBLIC_FILES = new Set(['/icon.svg', '/favicon.ico']);

function isPublic(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login/') || PUBLIC_FILES.has(pathname);
}

/**
 * 1) Admin panelning barcha sahifalari (kirish sahifasidan tashqari) faqat kirgan foydalanuvchi
 *    uchun. Bu tezkor tekshiruv (miltillashsiz yo'naltirish); rol va huquqlarni har bir so'rovda
 *    API tekshiradi.
 * 2) Barcha sahifalarga har so'rovda yangi nonce bilan Content-Security-Policy.
 */
function hasSessionHint(request: NextRequest): boolean {
  return AUTH_HINT_COOKIE_NAMES.some((name) => request.cookies.get(name)?.value === '1');
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isPublic(pathname) && !hasSessionHint(request)) {
    const login = new URL('/login', request.url);
    const next = `${pathname}${search}`;
    if (next !== '/') login.searchParams.set('next', next);
    return NextResponse.redirect(login);
  }
  return nextWithCsp(request, {
    isDev: process.env.NODE_ENV === 'development',
    mediaOrigins: process.env.MEDIA_ORIGIN,
  });
}

export const config = {
  // API va build fayllaridan (/_next/static — topilmasa oddiy matnli 404) tashqari hammasi.
  // Istisnolar ataylab minimal: istisno qilingan yo'l HTML qaytarsa, u CSP'siz qolardi
  matcher: ['/((?!api/|_next/static/).*)'],
};
