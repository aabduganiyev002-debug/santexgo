import { AUTH_COOKIES } from '@santexgo/shared';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Admin panelning barcha sahifalari faqat kirgan foydalanuvchi uchun. Bu tezkor tekshiruv
 * (miltillashsiz yo'naltirish); rol va huquqlarni har bir so'rovda API tekshiradi.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get(AUTH_COOKIES.hint)?.value === '1') return NextResponse.next();
  const login = new URL('/login', request.url);
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (next !== '/') login.searchParams.set('next', next);
  return NextResponse.redirect(login);
}

export const config = {
  // Kirish sahifasi, API, statik fayllar va ikonka bundan mustasno
  matcher: ['/((?!login|api|_next|icon\\.svg|favicon\\.ico).*)'],
};
