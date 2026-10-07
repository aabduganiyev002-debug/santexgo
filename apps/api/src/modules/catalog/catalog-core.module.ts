import { Global, Module } from '@nestjs/common';
import { CatalogCacheService } from './catalog-cache.service.js';
import { CategoryPresenter } from './category.presenter.js';
import { ProductCardMapper } from './product-card.mapper.js';
import { ProductQueryService } from './product-query.service.js';
import { SearchTextService } from './search-text.service.js';

/** Katalogning umumiy qismlari: sayt API'si, admin va narx moduli birgalikda ishlatadi. */
@Global()
@Module({
  providers: [
    CatalogCacheService,
    CategoryPresenter,
    ProductCardMapper,
    ProductQueryService,
    SearchTextService,
  ],
  exports: [
    CatalogCacheService,
    CategoryPresenter,
    ProductCardMapper,
    ProductQueryService,
    SearchTextService,
  ],
})
export class CatalogCoreModule {}
