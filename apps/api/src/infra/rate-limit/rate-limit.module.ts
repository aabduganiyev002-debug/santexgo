import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service.js';
import { ThrottlerStorageAdapter } from './throttler-storage.js';

@Global()
@Module({
  providers: [RateLimitService, ThrottlerStorageAdapter],
  exports: [RateLimitService, ThrottlerStorageAdapter],
})
export class RateLimitModule {}
