import { Module } from '@nestjs/common';
import { CartCalculator } from './cart-calculator.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({
  controllers: [CartController],
  providers: [CartCalculator, CartService],
  exports: [CartCalculator, CartService],
})
export class CartModule {}
