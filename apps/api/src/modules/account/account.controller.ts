import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AccountOverview,
  addressSaveSchema,
  type AddressView,
  type AuthUser,
  changePasswordSchema,
  changePhoneSchema,
  type FavoriteIds,
  favoritesQuerySchema,
  type Paginated,
  type ProductCard,
  profileUpdateSchema,
  sendCodeSchema,
  type SendCodeResponse,
  type z,
} from '@santexgo/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { RequestUser } from '../../common/auth/request-user.js';
import { clientInfo } from '../../common/http/client-info.js';
import { UuidParam } from '../../common/validation/params.js';
import { ZodBody, ZodQuery } from '../../common/validation/zod-validation.js';
import { AddressesService } from './addresses.service.js';
import { FavoritesService } from './favorites.service.js';
import { ProfileService } from './profile.service.js';

const SENSITIVE_LIMIT = { default: { limit: 10, ttl: 10 * 60_000 } };

@ApiTags('Shaxsiy kabinet')
@Controller('account')
export class AccountController {
  constructor(private readonly profile: ProfileService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Kabinet: buyurtmalar soni, jami xarid summasi, hozirgi buyurtmalar, manzillar',
  })
  overview(@CurrentUser() user: RequestUser): Promise<AccountOverview> {
    return this.profile.overview(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Ism va familiyani o‘zgartirish' })
  updateProfile(
    @CurrentUser() user: RequestUser,
    @ZodBody(profileUpdateSchema) body: z.output<typeof profileUpdateSchema>,
  ): Promise<AuthUser> {
    return this.profile.updateProfile(user.id, body);
  }

  @Post('password')
  @Throttle(SENSITIVE_LIMIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Parolni o‘zgartirish',
    description: 'Joriy parol talab qilinadi. Boshqa qurilmalardagi sessiyalar yopiladi.',
  })
  changePassword(
    @CurrentUser() user: RequestUser,
    @ZodBody(changePasswordSchema) body: z.output<typeof changePasswordSchema>,
  ): Promise<void> {
    return this.profile.changePassword(user.id, user.sessionId, body);
  }

  @Post('phone/send-code')
  @Throttle(SENSITIVE_LIMIT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telefon raqamini o‘zgartirish: yangi raqamga SMS kod' })
  sendPhoneCode(
    @CurrentUser() user: RequestUser,
    @ZodBody(sendCodeSchema) body: z.output<typeof sendCodeSchema>,
    @Req() req: Request,
  ): Promise<SendCodeResponse> {
    return this.profile.sendPhoneCode(user.id, body.phone, clientInfo(req));
  }

  @Post('phone')
  @Throttle(SENSITIVE_LIMIT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Telefon raqamini o‘zgartirish: SMS kod bilan tasdiqlash' })
  changePhone(
    @CurrentUser() user: RequestUser,
    @ZodBody(changePhoneSchema) body: z.output<typeof changePhoneSchema>,
  ): Promise<AuthUser> {
    return this.profile.changePhone(user.id, body);
  }
}

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
