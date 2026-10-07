import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminDiscountDetail,
  type AdminDiscountListItem,
  type AdminDiscountProduct,
  discountInputSchema,
  discountListQuerySchema,
  discountUpdateSchema,
  movementsQuerySchema,
  type Paginated,
  type z,
} from '@santexgo/shared';
import { Actor, type ActorContext, Roles } from '../../../common/auth/decorators.js';
import { UuidParam } from '../../../common/validation/params.js';
import { ZodBody, ZodQuery } from '../../../common/validation/zod-validation.js';
import { AdminDiscountsService } from './admin-discounts.service.js';

@ApiTags('Admin: chegirmalar')
@Roles('ADMIN')
@Controller('admin/discounts')
export class AdminDiscountsController {
  constructor(private readonly discounts: AdminDiscountsService) {}

  @Get()
  @ApiOperation({ summary: 'Chegirmalar: amalda, rejalashtirilgan, tugagan, o‘chirilgan' })
  list(
    @ZodQuery(discountListQuerySchema) query: z.output<typeof discountListQuerySchema>,
  ): Promise<Paginated<AdminDiscountListItem>> {
    return this.discounts.list(query);
  }

  @Get(':id')
  get(@Param('id', UuidParam) id: string): Promise<AdminDiscountDetail> {
    return this.discounts.get(id);
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'Chegirma tegishli mahsulotlar va ularning narxlari' })
  products(
    @Param('id', UuidParam) id: string,
    @ZodQuery(movementsQuerySchema) query: z.output<typeof movementsQuerySchema>,
  ): Promise<Paginated<AdminDiscountProduct>> {
    return this.discounts.products(id, query.page, query.pageSize);
  }

  @Post()
  @ApiOperation({
    summary: 'Chegirma yaratish: foizli yoki summali, muddatli, mahsulot/kategoriya/brendga',
    description:
      'Kategoriyaga qo‘yilgan chegirma barcha ichki kategoriyalarga ham tegishli. ' +
      'Bir mahsulotga bir nechta chegirma tegishli bo‘lsa — mijoz uchun eng foydalisi qo‘llanadi.',
  })
  create(
    @ZodBody(discountInputSchema) body: z.output<typeof discountInputSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminDiscountDetail> {
    return this.discounts.create(body, actor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Tahrirlash (targets berilsa — to‘liq almashtiriladi)' })
  update(
    @Param('id', UuidParam) id: string,
    @ZodBody(discountUpdateSchema) body: z.output<typeof discountUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminDiscountDetail> {
    return this.discounts.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'O‘chirish (eski buyurtmalardagi narxlar o‘zgarmaydi)' })
  remove(@Param('id', UuidParam) id: string, @Actor() actor: ActorContext): Promise<void> {
    return this.discounts.remove(id, actor);
  }
}
