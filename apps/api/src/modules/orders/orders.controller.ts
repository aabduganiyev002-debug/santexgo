import { Controller, Get, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  cancelOrderSchema,
  checkoutSchema,
  myOrdersQuerySchema,
  type OrderDetailView,
  type OrderSummaryView,
  type Paginated,
  type z,
} from '@santexgo/shared';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { RequestUser } from '../../common/auth/request-user.js';
import { ZodBody, ZodQuery } from '../../common/validation/zod-validation.js';
import { CheckoutService } from './checkout.service.js';
import { OrderNumberParam } from './order-number.pipe.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Buyurtmalar')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrdersService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Buyurtma berish',
    description:
      'Mahsulotlar band qilinadi, narxlar buyurtmada muzlatiladi. idempotencyKey bir xil bo‘lsa, ' +
      'yangi buyurtma yaratilmaydi — avvalgisi qaytadi (200). expectedTotal farq qilsa — 409 PRICE_CHANGED.',
  })
  async create(
    @CurrentUser() user: RequestUser,
    @ZodBody(checkoutSchema) body: z.output<typeof checkoutSchema>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderDetailView> {
    const result = await this.checkout.checkout(user.id, body);
    res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.order;
  }

  @Get()
  @ApiOperation({ summary: 'Mening buyurtmalarim (yangilari birinchi)' })
  list(
    @CurrentUser() user: RequestUser,
    @ZodQuery(myOrdersQuerySchema) query: z.output<typeof myOrdersQuerySchema>,
  ): Promise<Paginated<OrderSummaryView>> {
    return this.orders.list(user.id, query);
  }

  @Get(':orderNumber')
  @ApiOperation({ summary: 'Buyurtma tafsiloti: mahsulotlar, summa, status tarixi' })
  detail(
    @CurrentUser() user: RequestUser,
    @Param('orderNumber', OrderNumberParam) orderNumber: number,
  ): Promise<OrderDetailView> {
    return this.orders.detail(user.id, orderNumber);
  }

  @Post(':orderNumber/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Buyurtmani bekor qilish (faqat tasdiqlanishidan oldin)' })
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('orderNumber', OrderNumberParam) orderNumber: number,
    @ZodBody(cancelOrderSchema) body: z.output<typeof cancelOrderSchema>,
  ): Promise<OrderDetailView> {
    return this.orders.cancel(user.id, orderNumber, body.reason);
  }
}
