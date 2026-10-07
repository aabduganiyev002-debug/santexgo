import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import {
  AccountController,
  AddressesController,
  FavoritesController,
} from './account.controller.js';
import { AddressesService } from './addresses.service.js';
import { FavoritesService } from './favorites.service.js';
import { ProfileService } from './profile.service.js';

/** Shaxsiy kabinet: profil, parol, telefon, sevimlilar va manzillar. */
@Module({
  imports: [AuthModule],
  controllers: [AccountController, FavoritesController, AddressesController],
  providers: [ProfileService, FavoritesService, AddressesService],
  exports: [AddressesService],
})
export class AccountModule {}
