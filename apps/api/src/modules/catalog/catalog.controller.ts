import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type BrandDetail,
  type BrandSummary,
  type CategoryDetail,
  type CategoryNode,
  type CollectionSummary,
  type HomePageData,
  type MaterialSummary,
  type ProductCard,
  type ProductDetail,
  type ProductListQuery,
  productListQuerySchema,
  type ProductListResponse,
  type SearchSuggestions,
  type SitemapData,
  SLUG_REGEX,
  suggestQuerySchema,
} from '@santexgo/shared';
import { Public } from '../../common/auth/decorators.js';
import { ApiError } from '../../common/errors/api-error.js';
import { ZodQuery } from '../../common/validation/zod-validation.js';
import { CatalogService } from './catalog.service.js';
import { ProductQueryService } from './product-query.service.js';

function assertSlug(slug: string): string {
  if (slug.length > 220 || !SLUG_REGEX.test(slug)) throw ApiError.notFound('Topilmadi');
  return slug;
}

@ApiTags('Katalog')
@Public()
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly products: ProductQueryService,
  ) {}

  @Get('home')
  @ApiOperation({
    summary:
      'Bosh sahifa: bannerlar, brendlar, material tugmalari, chegirmadagi, yangi va ommabop mahsulotlar',
  })
  home(): Promise<HomePageData> {
    return this.catalog.home();
  }

  @Get('brands')
  @ApiOperation({ summary: 'Brendlar ro‘yxati (mahsulotlar soni bilan)' })
  brands(): Promise<BrandSummary[]> {
    return this.catalog.brands();
  }

  @Get('brands/:slug')
  @ApiOperation({ summary: 'Brend sahifasi: ma’lumot va bo‘limlar (PPR TRUBA, PVC TRUBA...)' })
  brand(@Param('slug') slug: string): Promise<BrandDetail> {
    return this.catalog.brand(assertSlug(slug));
  }

  @Get('categories')
  @ApiOperation({ summary: 'Kategoriyalar daraxti (mahsulotlar soni bilan)' })
  categories(): Promise<CategoryNode[]> {
    return this.catalog.categoryTree();
  }

  @Get('categories/:slug')
  @ApiOperation({ summary: 'Kategoriya: yo‘l (breadcrumbs) va subkategoriyalar' })
  category(@Param('slug') slug: string): Promise<CategoryDetail> {
    return this.catalog.category(assertSlug(slug));
  }

  @Get('materials')
  @ApiOperation({ summary: 'Materiallar (PPR, PVC, PP...)' })
  materials(): Promise<MaterialSummary[]> {
    return this.catalog.materials();
  }

  @Get('collections')
  @ApiOperation({ summary: '"Material bo‘yicha" tugmalari — tayyor filtrlar' })
  collections(): Promise<CollectionSummary[]> {
    return this.catalog.collections();
  }

  @Get('products')
  @ApiOperation({
    summary: 'Mahsulotlar: filtrlar, saralash, sahifalash va filtr sonlari',
    description:
      'Xususiyat filtrlari kaliti bo‘yicha beriladi: `?brand=plastherm&material=ppr&diameter_mm=25&pn=PN20&priceMin=50000&priceMax=200000`. ' +
      'Bir nechta qiymat vergul bilan: `diameter_mm=25,32`.',
  })
  list(@ZodQuery(productListQuerySchema) query: ProductListQuery): Promise<ProductListResponse> {
    return this.products.list(query);
  }

  @Get('products/:slug')
  @ApiOperation({ summary: 'Mahsulot sahifasi' })
  product(@Param('slug') slug: string): Promise<ProductDetail> {
    return this.catalog.product(assertSlug(slug));
  }

  @Get('products/:slug/similar')
  @ApiOperation({ summary: 'O‘xshash mahsulotlar' })
  similar(@Param('slug') slug: string): Promise<ProductCard[]> {
    return this.catalog.similar(assertSlug(slug));
  }

  @Get('sitemap')
  @ApiOperation({ summary: 'sitemap.xml uchun ochiq sahifalar ro‘yxati' })
  sitemap(): Promise<SitemapData> {
    return this.catalog.sitemap();
  }

  @Get('search/suggest')
  @ApiOperation({ summary: 'Qidiruv maydoni uchun tezkor takliflar (yozish jarayonida)' })
  suggest(@ZodQuery(suggestQuerySchema) query: { q: string }): Promise<SearchSuggestions> {
    return this.catalog.suggest(query.q);
  }
}
