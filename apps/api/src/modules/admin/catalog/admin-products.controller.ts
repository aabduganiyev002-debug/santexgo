import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminInventoryMovement,
  type AdminProductDetail,
  type AdminProductImage,
  type AdminProductListItem,
  adminProductListQuerySchema,
  type AdminWarehouseStock,
  type DeleteResult,
  documentInputSchema,
  imageReorderSchema,
  imageUpdateSchema,
  inventoryAdjustSchema,
  lowStockThresholdSchema,
  movementsQuerySchema,
  type Paginated,
  productInputSchema,
  productUpdateSchema,
  type z,
} from '@santexgo/shared';
import { Actor, type ActorContext, Roles } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import {
  MAX_DOCUMENT_BYTES,
  MultipleImagesUpload,
  SingleFileUpload,
  type UploadedFileData,
} from '../../../common/http/uploads.js';
import { UuidParam } from '../../../common/validation/params.js';
import { ZodBody, ZodQuery, ZodValidationPipe } from '../../../common/validation/zod-validation.js';
import { AdminProductsService } from './admin-products.service.js';

@ApiTags('Admin: mahsulotlar')
@Roles('ADMIN')
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Mahsulotlar ro‘yxati: qidiruv (nom, SKU), filtrlar, saralash' })
  list(
    @ZodQuery(adminProductListQuerySchema) query: z.output<typeof adminProductListQuerySchema>,
  ): Promise<Paginated<AdminProductListItem>> {
    return this.products.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mahsulot (tahrirlash uchun to‘liq ma’lumot)' })
  get(@Param('id', UuidParam) id: string): Promise<AdminProductDetail> {
    return this.products.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Mahsulot qo‘shish (xususiyatlar va boshlang‘ich qoldiq bilan)' })
  create(
    @ZodBody(productInputSchema) body: z.output<typeof productInputSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminProductDetail> {
    return this.products.create(body, actor);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Tahrirlash (narx o‘zgarsa chegirmali narx avtomatik qayta hisoblanadi)',
    description: 'attributes: [{ key, value }] — value: null bo‘lsa xususiyat o‘chiriladi.',
  })
  update(
    @Param('id', UuidParam) id: string,
    @ZodBody(productUpdateSchema) body: z.output<typeof productUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminProductDetail> {
    return this.products.update(id, body, actor);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'O‘chirish: buyurtmalarda bo‘lsa — arxivlanadi, aks holda butunlay o‘chiriladi',
  })
  remove(@Param('id', UuidParam) id: string, @Actor() actor: ActorContext): Promise<DeleteResult> {
    return this.products.remove(id, actor);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Arxivdan qaytarish (saytda yana ko‘rinadi)' })
  restore(
    @Param('id', UuidParam) id: string,
    @Actor() actor: ActorContext,
  ): Promise<AdminProductDetail> {
    return this.products.restore(id, actor);
  }

  // ─────────────────────────────── Rasmlar ───────────────────────────────

  @Post(':id/images')
  @MultipleImagesUpload()
  @ApiOperation({ summary: 'Rasmlar yuklash (10 tagacha, har biri 10 MB gacha; WebP 3 o‘lchamda)' })
  uploadImages(
    @Param('id', UuidParam) id: string,
    @UploadedFiles() files: UploadedFileData[] | undefined,
    @Actor() actor: ActorContext,
  ): Promise<AdminProductImage[]> {
    if (!files || files.length === 0) throw ApiError.badRequest('FILE_INVALID', 'Fayl tanlanmagan');
    return this.products.uploadImages(
      id,
      files.map((f) => f.buffer),
      actor,
    );
  }

  @Put(':id/images/order')
  @ApiOperation({ summary: 'Rasmlar tartibi' })
  reorderImages(
    @Param('id', UuidParam) id: string,
    @ZodBody(imageReorderSchema) body: z.output<typeof imageReorderSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminProductImage[]> {
    return this.products.reorderImages(id, body.imageIds, actor);
  }

  @Patch(':id/images/:imageId')
  @ApiOperation({ summary: 'Rasm: asosiy qilish, alt matn' })
  updateImage(
    @Param('id', UuidParam) id: string,
    @Param('imageId', UuidParam) imageId: string,
    @ZodBody(imageUpdateSchema) body: z.output<typeof imageUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminProductImage[]> {
    return this.products.updateImage(id, imageId, body, actor);
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @Param('id', UuidParam) id: string,
    @Param('imageId', UuidParam) imageId: string,
    @Actor() actor: ActorContext,
  ): Promise<AdminProductImage[]> {
    return this.products.removeImage(id, imageId, actor);
  }

  // ─────────────────────────────── Hujjatlar ───────────────────────────────

  @Post(':id/documents')
  @SingleFileUpload(MAX_DOCUMENT_BYTES, {
    title: { type: 'string' },
    type: { type: 'string', enum: ['CERTIFICATE', 'PASSPORT', 'MANUAL', 'OTHER'] },
  })
  @ApiOperation({ summary: 'Sertifikat yoki yo‘riqnoma (PDF, 20 MB gacha)' })
  uploadDocument(
    @Param('id', UuidParam) id: string,
    @UploadedFile() file: UploadedFileData | undefined,
    @Body(new ZodValidationPipe(documentInputSchema)) body: z.output<typeof documentInputSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminProductDetail['documents']> {
    if (!file) throw ApiError.badRequest('FILE_INVALID', 'Fayl tanlanmagan');
    return this.products.uploadDocument(id, file.buffer, body, actor);
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDocument(
    @Param('id', UuidParam) id: string,
    @Param('documentId', UuidParam) documentId: string,
    @Actor() actor: ActorContext,
  ): Promise<void> {
    return this.products.removeDocument(id, documentId, actor);
  }

  // ─────────────────────────────── Ombor ───────────────────────────────

  @Post(':id/inventory')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Qoldiqni o‘zgartirish: add — kirim, remove — chiqim, set — inventarizatsiya',
  })
  adjustStock(
    @Param('id', UuidParam) id: string,
    @ZodBody(inventoryAdjustSchema) body: z.output<typeof inventoryAdjustSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminWarehouseStock[]> {
    return this.products.adjustStock(id, body, actor);
  }

  @Put(':id/inventory/threshold')
  @ApiOperation({ summary: '"Kam qoldi" ogohlantirish chegarasi' })
  setThreshold(
    @Param('id', UuidParam) id: string,
    @ZodBody(lowStockThresholdSchema) body: z.output<typeof lowStockThresholdSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminWarehouseStock[]> {
    return this.products.setLowStockThreshold(id, body.lowStockThreshold, body.warehouseId, actor);
  }

  @Get(':id/inventory/movements')
  @ApiOperation({ summary: 'Ombor harakatlari tarixi' })
  movements(
    @Param('id', UuidParam) id: string,
    @ZodQuery(movementsQuerySchema) query: z.output<typeof movementsQuerySchema>,
  ): Promise<Paginated<AdminInventoryMovement>> {
    return this.products.movements(id, query.page, query.pageSize);
  }
}
