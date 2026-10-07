import { Injectable } from '@nestjs/common';
import type { Breadcrumb, CategoryDetail, CategoryNode } from '@santexgo/shared';
import { MediaService } from '../../infra/storage/media.service.js';
import { CatalogCacheService } from './catalog-cache.service.js';
import type { CategoryRecord, CategoryTree } from './category-tree.js';

/** Kategoriyalarni sayt uchun ko'rinishga keltiradi: daraxt, yo'l (breadcrumbs), mahsulot sonlari. */
@Injectable()
export class CategoryPresenter {
  constructor(
    private readonly cache: CatalogCacheService,
    private readonly media: MediaService,
  ) {}

  /** Faol kategoriyalar daraxti. Mahsuloti yo'q kategoriyalar ham ko'rsatiladi (hideEmpty bo'lmasa). */
  async tree(options: { hideEmpty?: boolean } = {}): Promise<CategoryNode[]> {
    const [tree, stats] = await Promise.all([this.cache.categoryTree(), this.cache.catalogStats()]);
    const totals = tree.rollUp(stats.countBy('categoryId'));
    return this.nodes(tree, null, totals, options.hideEmpty ?? false);
  }

  async detail(category: CategoryRecord): Promise<CategoryDetail> {
    const [tree, stats] = await Promise.all([this.cache.categoryTree(), this.cache.catalogStats()]);
    const totals = tree.rollUp(stats.countBy('categoryId'));
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      imageUrl: this.media.urlOrNull(category.imageUrl),
      productCount: totals.get(category.id) ?? 0,
      breadcrumbs: this.breadcrumbs(tree, category.id),
      children: this.nodes(tree, category.id, totals, false),
    };
  }

  breadcrumbs(tree: CategoryTree, categoryId: string): Breadcrumb[] {
    return tree.path(categoryId).map((c) => ({ slug: c.slug, name: c.name }));
  }

  private nodes(
    tree: CategoryTree,
    parentId: string | null,
    totals: ReadonlyMap<string, number>,
    hideEmpty: boolean,
  ): CategoryNode[] {
    return tree
      .children(parentId)
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        imageUrl: this.media.urlOrNull(c.imageUrl),
        productCount: totals.get(c.id) ?? 0,
        children: this.nodes(tree, c.id, totals, hideEmpty),
      }))
      .filter((node) => !hideEmpty || node.productCount > 0);
  }
}
