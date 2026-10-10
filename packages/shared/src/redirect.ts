const PLACEHOLDER_ORIGIN = 'http://placeholder.invalid';

/**
 * Kirgandan keyin qaytish manzili (?next=...): faqat shu sayt ichidagi yo'l. Boshqa saytga olib
 * ketadigan har qanday qiymat (//evil.com, /\evil.com, "/<TAB>/evil.com" — URL tahlilchisi tab va
 * qator ko'chirish belgilarini olib tashlaydi) fallback bilan almashtiriladi.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  // Boshqaruv belgilari va teskari slesh: brauzerlar ularni "/" yoki umuman yo'q deb o'qishi mumkin
  // eslint-disable-next-line no-control-regex
  if (!next || !next.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  let url: URL;
  try {
    url = new URL(next, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
