import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SiteSettings } from '@santexgo/shared';
import { Public } from '../../common/auth/decorators.js';
import { SettingsService } from './settings.service.js';

@ApiTags('Sayt')
@Public()
@Controller('site')
export class SiteController {
  constructor(private readonly settings: SettingsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Do‘kon ma’lumotlari (telefon, manzil) va yetkazib berish qoidalari' })
  get(): Promise<SiteSettings> {
    return this.settings.get();
  }
}
