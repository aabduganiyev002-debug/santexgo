import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminCustomerDetail,
  type AdminCustomerListItem,
  adminCustomerListQuerySchema,
  adminCustomerUpdateSchema,
  type Paginated,
  type z,
} from '@santexgo/shared';
import { Actor, type ActorContext, Roles } from '../../../common/auth/decorators.js';
import { UuidParam } from '../../../common/validation/params.js';
import { ZodBody, ZodQuery } from '../../../common/validation/zod-validation.js';
import { AdminCustomersService } from './admin-customers.service.js';

@ApiTags('Admin: mijozlar')
@Roles('ADMIN')
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  @ApiOperation({
    summary: 'Mijozlar bazasi: ism, telefon, buyurtmalar soni, umumiy xarid summasi',
  })
  list(
    @ZodQuery(adminCustomerListQuerySchema) query: z.output<typeof adminCustomerListQuerySchema>,
  ): Promise<Paginated<AdminCustomerListItem>> {
    return this.customers.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mijoz: statistika, manzillar, oxirgi buyurtmalar' })
  detail(@Param('id', UuidParam) id: string): Promise<AdminCustomerDetail> {
    return this.customers.detail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Bloklash yoki blokdan chiqarish' })
  update(
    @Param('id', UuidParam) id: string,
    @ZodBody(adminCustomerUpdateSchema) body: z.output<typeof adminCustomerUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminCustomerDetail> {
    return this.customers.setActive(id, body.isActive, actor);
  }
}
