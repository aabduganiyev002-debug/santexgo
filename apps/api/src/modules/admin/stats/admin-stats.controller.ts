import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminSalesStats,
  type AdminStatsOverview,
  statsQuerySchema,
  type z,
} from '@santexgo/shared';
import { Roles } from '../../../common/auth/decorators.js';
import { ZodQuery } from '../../../common/validation/zod-validation.js';
import { AdminStatsService } from './admin-stats.service.js';

@ApiTags('Admin: statistika')
@Roles('ADMIN')
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Bugungi va oylik savdo, kutilayotgan buyurtmalar, mijozlar, ombor holati',
  })
  overview(): Promise<AdminStatsOverview> {
    return this.stats.overview();
  }

  @Get('sales')
  @ApiOperation({
    summary: 'Savdo dinamikasi, statuslar, eng ko‘p sotilgan mahsulotlar va brendlar, top mijozlar',
  })
  sales(
    @ZodQuery(statsQuerySchema) query: z.output<typeof statsQuerySchema>,
  ): Promise<AdminSalesStats> {
    return this.stats.sales(query.range);
  }
}
