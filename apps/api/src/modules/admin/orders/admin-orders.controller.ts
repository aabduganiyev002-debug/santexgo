import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminOrderDetail,
  type AdminOrderListResponse,
  adminOrderListQuerySchema,
  adminOrderUpdateSchema,
  orderStatusUpdateSchema,
  type z,
} from '@santexgo/shared';
import { Actor, type ActorContext, Roles } from '../../../common/auth/decorators.js';
import { ZodBody, ZodQuery } from '../../../common/validation/zod-validation.js';
import { OrderNumberParam } from '../../orders/order-number.pipe.js';
import { AdminOrdersService } from './admin-orders.service.js';

@ApiTags('Admin: buyurtmalar')
@Roles('ADMIN')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'Buyurtmalar: qidiruv (raqam, telefon, ism), status va sana bo‘yicha filtr',
  })
  list(
    @ZodQuery(adminOrderListQuerySchema) query: z.output<typeof adminOrderListQuerySchema>,
  ): Promise<AdminOrderListResponse> {
    return this.orders.list(query);
  }

  @Get(':orderNumber')
  @ApiOperation({ summary: 'Buyurtma: mijoz, manzil, mahsulotlar, summa, to‘lov, status tarixi' })
  detail(@Param('orderNumber', OrderNumberParam) orderNumber: number): Promise<AdminOrderDetail> {
    return this.orders.detail(orderNumber);
  }

  @Patch(':orderNumber/status')
  @ApiOperation({
    summary: 'Statusni o‘zgartirish',
    description:
      'Yetkazib berilmoqda — mahsulot ombordan chiqadi; Yetkazildi — sotilganlar soni oshadi; ' +
      'Bekor qilindi — band bo‘shaydi (yo‘lga chiqqan bo‘lsa omborga qaytadi).',
  })
  changeStatus(
    @Param('orderNumber', OrderNumberParam) orderNumber: number,
    @ZodBody(orderStatusUpdateSchema) body: z.output<typeof orderStatusUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminOrderDetail> {
    return this.orders.changeStatus(orderNumber, body, actor);
  }

  @Patch(':orderNumber')
  @ApiOperation({ summary: 'Ichki izoh va to‘lov holati' })
  update(
    @Param('orderNumber', OrderNumberParam) orderNumber: number,
    @ZodBody(adminOrderUpdateSchema) body: z.output<typeof adminOrderUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminOrderDetail> {
    return this.orders.update(orderNumber, body, actor);
  }
}
