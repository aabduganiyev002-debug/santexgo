import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { ConsoleSmsSender } from './console-sms.sender.js';
import { EskizSmsSender } from './eskiz-sms.sender.js';
import { SmsSender } from './sms-sender.js';
import { SmsService } from './sms.service.js';

@Global()
@Module({
  providers: [
    {
      provide: SmsSender,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): SmsSender => {
        if (config.get('SMS_PROVIDER', { infer: true }) === 'eskiz') {
          return new EskizSmsSender({
            email: config.get('ESKIZ_EMAIL', { infer: true })!,
            password: config.get('ESKIZ_PASSWORD', { infer: true })!,
            from: config.get('SMS_SENDER', { infer: true }),
          });
        }
        return new ConsoleSmsSender();
      },
    },
    SmsService,
  ],
  exports: [SmsService, SmsSender],
})
export class SmsModule {}
