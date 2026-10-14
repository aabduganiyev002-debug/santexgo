import { Global, Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module.js';
import { CartModule } from '../cart/cart.module.js';
import { CheckoutService } from './checkout.service.js';
import { OrderPresenter } from './order.presenter.js';
import { OrderStatusService } from './order-status.service.js';
import { OrderStockService } from './order-stock.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

/** Buyurtmalar. Status va ombor xizmatlari admin moduli bilan umumiy. */
@Global()
@Module({
  imports: [CartModule, AccountModule],
  controllers: [OrdersController],
  providers: [
    OrderPresenter,
    OrderStockService,
    OrderStatusService,
    CheckoutService,
    OrdersService,
  ],
  exports: [OrderPresenter, OrderStatusService],
})
export class OrdersModule {}
