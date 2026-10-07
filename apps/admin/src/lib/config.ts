/** Mijozlar saytining manzili ("Saytda ko'rish" havolalari uchun). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);
