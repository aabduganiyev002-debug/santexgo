import { AUTH_COOKIES } from '@santexgo/shared';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Kabinet va buyurtma berish sahifalari faqat kirgan foydalanuvchi uchun: "kirgan" belgisi
 * bo'lmasa — sahifa yuklanmasdan kirish sahifasiga yo'naltiriladi (keyin shu yerga qaytadi).
 * Haqiqiy tekshiruv API'da; bu faqat ortiqcha yuklanish va miltillashning oldini oladi.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get(AUTH_COOKIES.hint)?.value === '1') return NextResponse.next();
  const login = new URL('/login', request.url);
  login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/account/:path*', '/checkout/:path*'],
};
