import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminAttribute,
  type AdminMaterial,
  type AdminProductGroup,
  type AdminWarehouse,
  attributeInputSchema,
  attributeUpdateSchema,
  listQuerySchema,
  materialInputSchema,
  materialUpdateSchema,
  productGroupInputSchema,
  productGroupUpdateSchema,
  type z,
} from '@santexgo/shared';
import { Actor, type ActorContext, Roles } from '../../../common/auth/decorators.js';
import { UuidParam } from '../../../common/validation/params.js';
import { ZodBody, ZodQuery } from '../../../common/validation/zod-validation.js';
import { AdminTaxonomyService } from './admin-taxonomy.service.js';

@ApiTags('Admin: materiallar')
@Roles('ADMIN')
@Controller('admin/materials')
export class AdminMaterialsController {
  constructor(private readonly taxonomy: AdminTaxonomyService) {}

  @Get()
  list(): Promise<AdminMaterial[]> {
    return this.taxonomy.listMaterials();
  }

  @Post()
  @ApiOperation({ summary: 'Material qo‘shish (PPR, PVC, PP...)' })
  create(
    @ZodBody(materialInputSchema) body: z.output<typeof materialInputSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminMaterial> {
    return this.taxonomy.createMaterial(body, actor);
  }

  @Patch(':id')
  update(
    @Param('id', UuidParam) id: string,
    @ZodBody(materialUpdateSchema) body: z.output<typeof materialUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminMaterial> {
    return this.taxonomy.updateMaterial(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidParam) id: string, @Actor() actor: ActorContext): Promise<void> {
    return this.taxonomy.removeMaterial(id, actor);
  }
}

@ApiTags('Admin: xususiyatlar')
@Roles('ADMIN')
@Controller('admin/attributes')
export class AdminAttributesController {
  constructor(private readonly taxonomy: AdminTaxonomyService) {}

  @Get()
  @ApiOperation({ summary: 'Texnik xususiyatlar (diametr, PN, uzunlik...)' })
  list(): Promise<AdminAttribute[]> {
    return this.taxonomy.listAttributes();
  }

  @Post()
  @ApiOperation({ summary: 'Yangi xususiyat — saytda avtomatik filtr bo‘ladi (isFilterable)' })
  create(
    @ZodBody(attributeInputSchema) body: z.output<typeof attributeInputSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminAttribute> {
    return this.taxonomy.createAttribute(body, actor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Tahrirlash (kalit va tur o‘zgarmaydi)' })
  update(
    @Param('id', UuidParam) id: string,
    @ZodBody(attributeUpdateSchema) body: z.output<typeof attributeUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminAttribute> {
    return this.taxonomy.updateAttribute(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', UuidParam) id: string, @Actor() actor: ActorContext): Promise<void> {
    return this.taxonomy.removeAttribute(id, actor);
  }
}

@ApiTags('Admin: mahsulot guruhlari')
@Roles('ADMIN')
@Controller('admin/product-groups')
export class AdminProductGroupsController {
  constructor(private readonly taxonomy: AdminTaxonomyService) {}

  @Get()
  @ApiOperation({ summary: 'Bir modelning o‘lchamlari guruhlari (variantlar)' })
  list(
    @ZodQuery(listQuerySchema) query: z.output<typeof listQuerySchema>,
  ): Promise<AdminProductGroup[]> {
    return this.taxonomy.listGroups(query.q);
  }

  @Post()
  create(
    @ZodBody(productGroupInputSchema) body: z.output<typeof productGroupInputSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminProductGroup> {
    return this.taxonomy.createGroup(body, actor);
  }

  @Patch(':id')
  update(
    @Param('id', UuidParam) id: string,
    @ZodBody(productGroupUpdateSchema) body: z.output<typeof productGroupUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminProductGroup> {
    return this.taxonomy.updateGroup(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Guruhni o‘chirish (mahsulotlar o‘chmaydi, faqat guruhdan chiqadi)' })
  remove(@Param('id', UuidParam) id: string, @Actor() actor: ActorContext): Promise<void> {
    return this.taxonomy.removeGroup(id, actor);
  }
}

@ApiTags('Admin: omborlar')
@Roles('ADMIN')
@Controller('admin/warehouses')
export class AdminWarehousesController {
  constructor(private readonly taxonomy: AdminTaxonomyService) {}

  @Get()
  list(): Promise<AdminWarehouse[]> {
    return this.taxonomy.listWarehouses();
  }
}
