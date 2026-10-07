import { Module } from '@nestjs/common';
import { AdminBrandsController } from './catalog/admin-brands.controller.js';
import { AdminBrandsService } from './catalog/admin-brands.service.js';
import { AdminCategoriesController } from './catalog/admin-categories.controller.js';
import { AdminCategoriesService } from './catalog/admin-categories.service.js';
import { AdminProductsController } from './catalog/admin-products.controller.js';
import { AdminProductsService } from './catalog/admin-products.service.js';
import {
  AdminAttributesController,
  AdminMaterialsController,
  AdminProductGroupsController,
  AdminWarehousesController,
} from './catalog/admin-taxonomy.controller.js';
import { AdminTaxonomyService } from './catalog/admin-taxonomy.service.js';

/** Admin panel API'lari: barchasi /api/v1/admin/... va faqat ADMIN roli uchun. */
@Module({
  controllers: [
    AdminBrandsController,
    AdminCategoriesController,
    AdminMaterialsController,
    AdminAttributesController,
    AdminProductGroupsController,
    AdminWarehousesController,
    AdminProductsController,
  ],
  providers: [
    AdminBrandsService,
    AdminCategoriesService,
    AdminTaxonomyService,
    AdminProductsService,
  ],
})
export class AdminModule {}
