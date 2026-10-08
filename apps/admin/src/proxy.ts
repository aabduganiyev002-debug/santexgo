import { AUTH_COOKIES } from '@santexgo/shared';
import { nextWithCsp } from '@santexgo/ui/csp';
import { type NextRequest, NextResponse } from 'next/server';

function isLoginPage(pathname: string): boolean {
  return pathname === '/login' || pathname.startsWith('/login/');
}

/**
 * 1) Admin panelning barcha sahifalari (kirish sahifasidan tashqari) faqat kirgan foydalanuvchi
 *    uchun. Bu tezkor tekshiruv (miltillashsiz yo'naltirish); rol va huquqlarni har bir so'rovda
 *    API tekshiradi.
 * 2) Barcha sahifalarga har so'rovda yangi nonce bilan Content-Security-Policy.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!isLoginPage(pathname) && request.cookies.get(AUTH_COOKIES.hint)?.value !== '1') {
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
  // API, statik fayllar va ikonkadan tashqari hammasi
  matcher: ['/((?!api/|_next/static/|_next/image|icon\\.svg|favicon\\.ico).*)'],
};
