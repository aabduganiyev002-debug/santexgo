export interface CategoryRecord {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** Kategoriyalar daraxti xotirada: subkategoriyalar, ota-kategoriyalar va yo'llar bo'yicha tez qidiruv. */
export class CategoryTree {
  readonly byId = new Map<string, CategoryRecord>();
  readonly bySlug = new Map<string, CategoryRecord>();
  private readonly childrenOf = new Map<string | null, CategoryRecord[]>();

  constructor(records: readonly CategoryRecord[]) {
    for (const record of records) {
      this.byId.set(record.id, record);
      this.bySlug.set(record.slug, record);
    }
    for (const record of records) {
      // Ota-kategoriya topilmasa (o'chirilgan bo'lsa) — ildiz sifatida ko'rsatiladi
      const parentKey = record.parentId && this.byId.has(record.parentId) ? record.parentId : null;
      const list = this.childrenOf.get(parentKey) ?? [];
      list.push(record);
      this.childrenOf.set(parentKey, list);
    }
    for (const list of this.childrenOf.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    }
  }

  children(id: string | null, activeOnly = true): CategoryRecord[] {
    const list = this.childrenOf.get(id) ?? [];
    return activeOnly ? list.filter((c) => c.isActive) : list;
  }

  roots(activeOnly = true): CategoryRecord[] {
    return this.children(null, activeOnly);
  }

  /** Kategoriyaning o'zi va barcha ichki kategoriyalari ID'lari. */
  descendantIds(id: string, activeOnly = true): string[] {
    const result: string[] = [];
    const stack = [id];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      const record = this.byId.get(current);
      if (!record || (activeOnly && !record.isActive)) continue;
      result.push(current);
      for (const child of this.children(current, activeOnly)) stack.push(child.id);
    }
    return result;
  }

  /** Ildizdan berilgan kategoriyagacha bo'lgan yo'l (o'zi ham kiradi). */
  path(id: string): CategoryRecord[] {
    const result: CategoryRecord[] = [];
    const seen = new Set<string>();
    let current = this.byId.get(id);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      result.unshift(current);
      current = current.parentId ? this.byId.get(current.parentId) : undefined;
    }
    return result;
  }

  /** Kategoriya va uning barcha ota-kategoriyalari faolmi (saytda ko'rinadimi). */
  isVisible(id: string): boolean {
    const path = this.path(id);
    return path.length > 0 && path.every((c) => c.isActive);
  }

  /** `ancestorId` kategoriyasi `id` ning o'zi yoki ota-kategoriyasimi. */
  isAncestorOrSelf(ancestorId: string, id: string): boolean {
    return this.path(id).some((c) => c.id === ancestorId);
  }

  /**
   * Har bir kategoriya bo'yicha mahsulotlar soni (o'zida + barcha ichki kategoriyalarda).
   * direct — faqat o'ziga biriktirilgan mahsulotlar soni.
   */
  rollUp(direct: ReadonlyMap<string, number>): Map<string, number> {
    const totals = new Map<string, number>();
    for (const [categoryId, count] of direct) {
      for (const node of this.path(categoryId)) {
        totals.set(node.id, (totals.get(node.id) ?? 0) + count);
      }
    }
    return totals;
  }
}
