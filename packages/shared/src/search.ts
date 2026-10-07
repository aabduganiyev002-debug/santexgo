import { transliterate } from './slug.js';

const MAX_TOKENS = 8;

/**
 * Sinonimlar (normallashtirilgan ko'rinishda): mijoz rus, o'zbek yoki xalq tilida yozishi mumkin.
 * "пвх труба" → "pvx truba" → PVC truba; "quvur" → truba; "otvod" → tirsak.
 */
export const SEARCH_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  pvx: ['pvc'],
  pvc: ['pvx'],
  quvur: ['truba'],
  truba: ['quvur'],
  trubka: ['truba'],
  otvod: ['tirsak'],
  ugolok: ['tirsak'],
  ugol: ['tirsak'],
  koleno: ['tirsak'],
  tirsak: ['otvod', 'ugolok'],
  fiting: ['fitting'],
  sharovoy: ['sharli'],
  ventil: ['kran'],
  jumrak: ['kran'],
  kanal: ['kanalizatsiya'],
  kanalizasiya: ['kanalizatsiya'],
  nojnitsi: ['qaychi'],
  nojnitsy: ['qaychi'],
  obratniy: ['teskari'],
  obratnyy: ['teskari'],
};

/** So'z va uning sinonimlari. */
export function tokenVariants(token: string): string[] {
  return [token, ...(SEARCH_SYNONYMS[token] ?? [])];
}

/**
 * Qidiruv uchun matnni yagona ko'rinishga keltiradi (mahsulot matni ham, so'rov ham):
 * kichik harf, kirill → lotin, apostroflarsiz, "Ø25" → "d25", "3,4" → "3.4", '1/2"' → "1/2".
 * "Труба ППР Ø25" va "truba ppr d25" bir xil natija beradi.
 */
export function normalizeSearchText(input: string): string {
  return (
    transliterate(input.toLowerCase())
      // Apostroflar va dyuym belgisi: 1/2" → 1/2 (mijoz odatda qo'shtirnoqsiz yozadi)
      .replace(/[ʻʼ‘’'`"″]/g, '')
      .replace(/[ø⌀]/g, 'd')
      .replace(/(\d),(\d)/g, '$1.$2')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9/.]+/g, ' ')
      .replace(/(^|\s)[./]+|[./]+(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Qidiruv so'rovini so'zlarga ajratadi: "Plastherm 25 PN20" → ["plastherm", "25", "pn20"]. */
export function searchTokens(query: string): string[] {
  const tokens = normalizeSearchText(query).split(' ').filter(Boolean);
  return [...new Set(tokens)].slice(0, MAX_TOKENS);
}
