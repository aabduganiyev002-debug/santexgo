import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  addressSaveSchema,
  type AddressView,
  type FavoriteIds,
  favoritesQuerySchema,
  type Paginated,
  type ProductCard,
  type z,
} from '@santexgo/shared';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { RequestUser } from '../../common/auth/request-user.js';
import { UuidParam } from '../../common/validation/params.js';
import { ZodBody, ZodQuery } from '../../common/validation/zod-validation.js';
import { AddressesService } from './addresses.service.js';
import { FavoritesService } from './favorites.service.js';

@ApiTags('Sevimlilar')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Sevimli mahsulotlar' })
  list(
    @CurrentUser() user: RequestUser,
    @ZodQuery(favoritesQuerySchema) query: z.output<typeof favoritesQuerySchema>,
  ): Promise<Paginated<ProductCard>> {
    return this.favorites.list(user.id, query.page, query.pageSize);
  }

  @Get('ids')
  @ApiOperation({ summary: 'Sevimli mahsulotlar ID ro‘yxati (yurakchalarni belgilash uchun)' })
  ids(@CurrentUser() user: RequestUser): Promise<FavoriteIds> {
    return this.favorites.ids(user.id);
  }

  @Put(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  add(
    @CurrentUser() user: RequestUser,
    @Param('productId', UuidParam) productId: string,
  ): Promise<void> {
    return this.favorites.add(user.id, productId);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('productId', UuidParam) productId: string,
  ): Promise<void> {
    return this.favorites.remove(user.id, productId);
  }
}

@ApiTags('Manzillar')
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'Saqlangan manzillar (asosiysi birinchi)' })
  list(@CurrentUser() user: RequestUser): Promise<AddressView[]> {
    return this.addresses.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @ZodBody(addressSaveSchema) body: z.output<typeof addressSaveSchema>,
  ): Promise<AddressView> {
    return this.addresses.create(user.id, body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Manzilni to‘liq yangilash' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', UuidParam) id: string,
    @ZodBody(addressSaveSchema) body: z.output<typeof addressSaveSchema>,
  ): Promise<AddressView> {
    return this.addresses.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: RequestUser, @Param('id', UuidParam) id: string): Promise<void> {
    return this.addresses.remove(user.id, id);
  }
}
