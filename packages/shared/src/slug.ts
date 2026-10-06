const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'x',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sh',
  ъ: '',
  ы: 'i',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ў: 'o',
  қ: 'q',
  ғ: 'g',
  ҳ: 'h',
};

/**
 * URL uchun slug yaratadi (lotin, kirill va o'zbek harflarini qo'llab-quvvatlaydi).
 * "Plastherm PPR truba Ø25 PN20" → "plastherm-ppr-truba-d25-pn20"
 * "Sharli kran 1/2\"" → "sharli-kran-1-2"
 */
export function slugify(input: string, maxLength = 200): string {
  const slug = input
    .toLowerCase()
    .replace(/[ʻʼ‘’'`]/g, '')
    .replace(/[ø⌀]/g, 'd')
    .replace(/[а-яёўқғҳ]/g, (ch) => CYRILLIC_TO_LATIN[ch] ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, maxLength).replace(/-+$/g, '');
}
