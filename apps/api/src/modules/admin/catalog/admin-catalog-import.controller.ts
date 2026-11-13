import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type CatalogImportBatchResult,
  type CatalogImportImageResult,
  type SampleDataRemoval,
  type SampleDataSummary,
  catalogImportBatchSchema,
  catalogImportImageSchema,
  type z,
} from '@santexgo/shared';
import { Actor, type ActorContext, Roles } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import {
  MAX_IMAGE_BYTES,
  SingleFileUpload,
  type UploadedFileData,
} from '../../../common/http/uploads.js';
import { ZodBody, ZodValidationPipe } from '../../../common/validation/zod-validation.js';
import { AdminCatalogImportService } from './admin-catalog-import.service.js';
import { AdminSampleDataService } from './admin-sample-data.service.js';

/** Katalog importi: minglab mahsulot va yuzlab rasm — umumiy so'rovlar chegarasidan kengroq */
const IMPORT_LIMIT = { default: { limit: 3000, ttl: 60_000 } };

@ApiTags('Admin: katalog importi')
@Roles('ADMIN')
@Throttle(IMPORT_LIMIT)
@Controller('admin/catalog-import')
export class AdminCatalogImportController {
  constructor(
    private readonly imports: AdminCatalogImportService,
    private readonly samples: AdminSampleDataService,
  ) {}

  @Post('products')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mahsulotlar bo‘lagi (100 tagacha): SKU bo‘yicha yaratish yoki yangilash',
    description:
      'Yangi mahsulot — boshlang‘ich qoldig‘i bilan; mavjudida nom, narx, birlik, qisqa tavsif va ' +
      'xususiyatlar yangilanadi. Kategoriya, brend, materiallar slug bo‘yicha — yo‘g‘i yaratiladi.',
  })
  importProducts(
    @ZodBody(catalogImportBatchSchema) body: z.output<typeof catalogImportBatchSchema>,
    @Actor() actor: ActorContext,
  ): Promise<CatalogImportBatchResult> {
    return this.imports.importBatch(body, actor);
  }

  @Post('image')
  @HttpCode(HttpStatus.OK)
  @SingleFileUpload(MAX_IMAGE_BYTES, { skus: { type: 'string', example: 'PN102,PN103' } })
  @ApiOperation({
    summary: 'Bitta rasm — bir nechta mahsulotga (rasmi yo‘qlariga), fayllar bir marta saqlanadi',
  })
  attachImage(
    @UploadedFile() file: UploadedFileData | undefined,
    @Body(new ZodValidationPipe(catalogImportImageSchema))
    body: z.output<typeof catalogImportImageSchema>,
    @Actor() actor: ActorContext,
  ): Promise<CatalogImportImageResult> {
    if (!file) throw ApiError.badRequest('FILE_INVALID', 'Fayl tanlanmagan');
    return this.imports.attachImage(file.buffer, body.skus, actor);
  }

  @Get('sample-data')
  @ApiOperation({ summary: 'Saytdagi namunaviy (sinov) mahsulotlar va chegirmalar soni' })
  sampleData(): Promise<SampleDataSummary> {
    return this.samples.summary();
  }

  @Delete('sample-data')
  @ApiOperation({
    summary: 'Namunaviy ma’lumotlarni o‘chirish (haqiqiy katalog yuklangach)',
    description:
      'Seed yozgan namunaviy chegirmalar (narxlar qayta hisoblanadi), mahsulotlar (buyurtmalarda ' +
      'bo‘lsa — arxivlanadi), ularning guruhlari va Vero brendi.',
  })
  removeSampleData(@Actor() actor: ActorContext): Promise<SampleDataRemoval> {
    return this.samples.remove(actor);
  }
}
