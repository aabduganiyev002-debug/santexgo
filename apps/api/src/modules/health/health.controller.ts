import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/auth/decorators.js';
import { HealthService, type HealthReport } from './health.service.js';

@ApiTags('System')
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'API va unga bog‘liq xizmatlar holati (monitoring uchun)' })
  @ApiOkResponse({ description: 'Hammasi ishlayapti' })
  @ApiServiceUnavailableResponse({ description: 'Baza ishlamayapti' })
  check(): Promise<HealthReport> {
    return this.health.check();
  }
}
