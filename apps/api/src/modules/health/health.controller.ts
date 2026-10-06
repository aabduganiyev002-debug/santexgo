import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthService, type HealthReport } from './health.service.js';

@ApiTags('System')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'API va unga bog‘liq xizmatlar holati (monitoring uchun)' })
  @ApiOkResponse({ description: 'Hammasi ishlayapti' })
  @ApiServiceUnavailableResponse({ description: 'Baza yoki boshqa xizmat ishlamayapti' })
  check(): Promise<HealthReport> {
    return this.health.check();
  }
}
