import { type NextRequest, NextResponse } from 'next/server';

export interface CspOptions {
  /** next dev: React/Turbopack uchun eval va HMR websocket kerak */
  isDev: boolean;
  /** Rasmlar boshqa domendan (S3/CDN) berilsa — vergul bilan, masalan "https://media.santexgo.uz" */
  mediaOrigins?: string;
}

/** Har so'rov uchun yangi, taxmin qilib bo'lmaydigan nonce. */
function createNonce(): string {
  return btoa(crypto.randomUUID());
}

/** "https://a.uz/x, https://b.uz" → ["https://a.uz", "https://b.uz"]; noto'g'ri qiymatlar tashlanadi. */
function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => {
      try {
        const url = new URL(item.trim());
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => origin !== null);
}

/**
 * Content-Security-Policy. Skriptlar faqat shu so'rovning nonce'i bilan ishlaydi ('strict-dynamic' —
 * ular yuklagan chunk'lar ham): XSS orqali sahifaga tushgan skript bajarilmaydi. Uslublar uchun
 * 'unsafe-inline' qoladi (React style atributlari) — CSS orqali kod bajarib bo'lmaydi.
 */
export function buildCsp(nonce: string, { isDev, mediaOrigins }: CspOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...parseOrigins(mediaOrigins)],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...(isDev ? ['ws:'] : [])],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Proksi (proxy.ts) uchun: so'rovni CSP bilan davom ettiradi. Next.js nonce'ni so'rov
 * sarlavhasidagi CSP'dan o'qib, o'z skriptlariga avtomatik qo'yadi (sahifa dinamik bo'lishi shart).
 */
export function nextWithCsp(request: NextRequest, options: CspOptions): NextResponse {
  const nonce = createNonce();
  const policy = buildCsp(nonce, options);
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}
