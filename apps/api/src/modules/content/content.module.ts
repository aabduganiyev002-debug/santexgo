import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { SiteController } from './site.controller.js';

@Global()
@Module({
  controllers: [SiteController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class ContentModule {}
