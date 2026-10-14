import { Global, Module } from '@nestjs/common';
import { OrderNotificationsService } from './order-notifications.service.js';

@Global()
@Module({
  providers: [OrderNotificationsService],
  exports: [OrderNotificationsService],
})
export class NotificationsModule {}
