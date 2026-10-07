import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  cartItemsSchema,
  cartPreviewSchema,
  cartQuantitySchema,
  type CartView,
  cartViewQuerySchema,
  type z,
} from '@santexgo/shared';
import { CurrentUser, Public } from '../../common/auth/decorators.js';
import type { RequestUser } from '../../common/auth/request-user.js';
import { UuidParam } from '../../common/validation/params.js';
import { ZodBody, ZodQuery } from '../../common/validation/zod-validation.js';
import { CartCalculator } from './cart-calculator.js';
import { CartService } from './cart.service.js';

@ApiTags('Savatcha')
@Controller('cart')
export class CartController {
  constructor(
    private readonly cart: CartService,
    private readonly calculator: CartCalculator,
  ) {}

  @Public()
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mehmon savatchasini hisoblash (saqlanmaydi)',
    description:
      'Brauzerdagi savatcha uchun joriy narxlar, chegirmalar, qoldiq va yetkazib berish narxi.',
  })
  preview(@ZodBody(cartPreviewSchema) body: z.output<typeof cartPreviewSchema>): Promise<CartView> {
    return this.calculator.view(body.items, body.deliveryMethod);
  }

  @Get()
  @ApiOperation({ summary: 'Mening savatcham' })
  view(
    @CurrentUser() user: RequestUser,
    @ZodQuery(cartViewQuerySchema) query: z.output<typeof cartViewQuerySchema>,
  ): Promise<CartView> {
    return this.cart.view(user.id, query.deliveryMethod);
  }

  @Put('items/:productId')
  @ApiOperation({ summary: 'Mahsulot qo‘shish yoki miqdorini o‘zgartirish' })
  set(
    @CurrentUser() user: RequestUser,
    @Param('productId', UuidParam) productId: string,
    @ZodBody(cartQuantitySchema) body: z.output<typeof cartQuantitySchema>,
  ): Promise<CartView> {
    return this.cart.setQuantity(user.id, productId, body.quantity);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Mahsulotni savatchadan olib tashlash' })
  remove(
    @CurrentUser() user: RequestUser,
    @Param('productId', UuidParam) productId: string,
  ): Promise<CartView> {
    return this.cart.remove(user.id, productId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Savatchani tozalash' })
  clear(@CurrentUser() user: RequestUser): Promise<void> {
    return this.cart.clear(user.id);
  }

  @Post('merge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kirgandan keyin brauzerdagi savatchani qo‘shish' })
  merge(
    @CurrentUser() user: RequestUser,
    @ZodBody(cartItemsSchema) body: z.output<typeof cartItemsSchema>,
  ): Promise<CartView> {
    return this.cart.merge(user.id, body.items);
  }
}
