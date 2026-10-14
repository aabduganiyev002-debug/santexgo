import { Global, Module } from '@nestjs/common';
import { PricingSchedulerService } from './pricing-scheduler.service.js';
import { PricingService } from './pricing.service.js';

@Global()
@Module({
  providers: [PricingService, PricingSchedulerService],
  exports: [PricingService],
})
export class PricingModule {}
