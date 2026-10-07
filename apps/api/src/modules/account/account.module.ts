import { Module } from '@nestjs/common';
import { AddressesController, FavoritesController } from './account.controller.js';
import { AddressesService } from './addresses.service.js';
import { FavoritesService } from './favorites.service.js';

/** Shaxsiy kabinet: sevimlilar va manzillar. */
@Module({
  controllers: [FavoritesController, AddressesController],
  providers: [FavoritesService, AddressesService],
  exports: [AddressesService],
})
export class AccountModule {}
