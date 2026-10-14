/** Saytning ochiq manzili (SEO, sitemap, ijtimoiy tarmoqlar uchun to'liq havolalar). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);

export const SITE_NAME = 'SantexGo';

export const SITE_DESCRIPTION =
  'Santexnika mahsulotlari online do‘koni: PPR, PVC va PP trubalar, fittinglar, kanalizatsiya, kranlar va armatura. Plastherm, Vero va boshqa brendlar.';
