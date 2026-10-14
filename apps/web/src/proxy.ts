import { AUTH_HINT_COOKIE_NAMES } from '@santexgo/shared';
import { nextWithCsp } from '@santexgo/ui/csp';
import { type NextRequest, NextResponse } from 'next/server';

/** Faqat kirgan foydalanuvchi uchun sahifalar */
const PROTECTED = ['/account', '/checkout'];

function isProtected(pathname: string): boolean {
  return PROTECTED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * 1) Kabinet va buyurtma berish sahifalari: "kirgan" belgisi bo'lmasa — sahifa yuklanmasdan
 *    kirish sahifasiga yo'naltiriladi (keyin shu yerga qaytadi). Haqiqiy tekshiruv API'da;
 *    bu faqat ortiqcha yuklanish va miltillashning oldini oladi.
 * 2) Barcha sahifalarga har so'rovda yangi nonce bilan Content-Security-Policy.
 */
function hasSessionHint(request: NextRequest): boolean {
  return AUTH_HINT_COOKIE_NAMES.some((name) => request.cookies.get(name)?.value === '1');
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isProtected(pathname) && !hasSessionHint(request)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
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
