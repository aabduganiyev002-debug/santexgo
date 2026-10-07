import { normalizeSearchText } from '@santexgo/shared';

export interface SearchTextSource {
  name: string;
  sku: string;
  brand: string;
  categories: string[];
  material: { name: string; fullName: string | null } | null;
  attributes: { unit: string | null; value: string }[];
}

/**
 * Mahsulotning qidiruv matni: "Plastherm 25 PN20" kabi so'rovlar nom, SKU, brend, kategoriya,
 * material va o'lchamlar bo'yicha topilishi uchun hammasi bitta normallashtirilgan satrda.
 */
export function buildSearchText(source: SearchTextSource): string {
  const parts = [
    source.name,
    source.sku,
    // SKU qismlarsiz ham: PLTPPRPN2025
    source.sku.replace(/[^a-z0-9]/gi, ''),
    source.brand,
    ...source.categories,
    source.material?.name ?? '',
    source.material?.fullName ?? '',
  ];
  for (const attribute of source.attributes) {
    parts.push(attribute.value);
    if (attribute.unit && /^\d/.test(attribute.value)) {
      parts.push(`${attribute.value}${attribute.unit}`);
    }
  }
  const words = normalizeSearchText(parts.join(' ')).split(' ');
  return [...new Set(words)].join(' ').slice(0, 4000);
}
