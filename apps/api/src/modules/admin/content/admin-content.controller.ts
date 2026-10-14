import {
  applyDecorators,
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
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AdminBanner,
  type AdminHomeCollection,
  bannerInputSchema,
  deliverySettingsSchema,
  homeCollectionInputSchema,
  homeCollectionUpdateSchema,
  type SiteSettings,
  storeSettingsSchema,
  type z,
} from '@santexgo/shared';
import { Actor, type ActorContext, Roles } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import {
  MAX_IMAGE_BYTES,
  SingleFileUpload,
  type UploadedFileData,
} from '../../../common/http/uploads.js';
import { UuidParam } from '../../../common/validation/params.js';
import { ZodBody, ZodValidationPipe } from '../../../common/validation/zod-validation.js';
import { SettingsService } from '../../content/settings.service.js';
import { AdminContentService } from './admin-content.service.js';

interface BannerFiles {
  image?: UploadedFileData[];
  mobileImage?: UploadedFileData[];
}

/** Banner rasmlari: "image" (kompyuter) va "mobileImage" (telefon, ixtiyoriy) + forma maydonlari. */
function BannerUpload() {
  return applyDecorators(
    UseInterceptors(
      FileFieldsInterceptor(
        [
          { name: 'image', maxCount: 1 },
          { name: 'mobileImage', maxCount: 1 },
        ],
        { limits: { fileSize: MAX_IMAGE_BYTES, files: 2 } },
      ),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            format: 'binary',
            description: 'Kompyuter uchun (1920px gacha)',
          },
          mobileImage: {
            type: 'string',
            format: 'binary',
            description: 'Telefon uchun (ixtiyoriy)',
          },
          title: { type: 'string' },
          subtitle: { type: 'string' },
          linkUrl: { type: 'string', example: '/brands/plastherm' },
          sortOrder: { type: 'integer' },
          isActive: { type: 'boolean' },
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time' },
        },
      },
    }),
  );
}

@ApiTags('Admin: sayt kontenti')
@Roles('ADMIN')
@Controller('admin')
export class AdminContentController {
  constructor(
    private readonly content: AdminContentService,
    private readonly settings: SettingsService,
  ) {}

  // ─────────────────────────────── Bannerlar ───────────────────────────────

  @Get('banners')
  listBanners(): Promise<AdminBanner[]> {
    return this.content.listBanners();
  }

  @Post('banners')
  @BannerUpload()
  @ApiOperation({ summary: 'Bosh sahifa slayderiga banner qo‘shish (rasm majburiy)' })
  createBanner(
    @UploadedFiles() files: BannerFiles | undefined,
    @Body(new ZodValidationPipe(bannerInputSchema)) body: z.output<typeof bannerInputSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminBanner> {
    const image = files?.image?.[0];
    if (!image) throw ApiError.badRequest('FILE_INVALID', 'Banner rasmini tanlang');
    return this.content.createBanner(body, image.buffer, files?.mobileImage?.[0]?.buffer, actor);
  }

  @Patch('banners/:id')
  @BannerUpload()
  @ApiOperation({ summary: 'Bannerni tahrirlash (rasmni almashtirish ixtiyoriy)' })
  updateBanner(
    @Param('id', UuidParam) id: string,
    @UploadedFiles() files: BannerFiles | undefined,
    @Body(new ZodValidationPipe(bannerInputSchema)) body: z.output<typeof bannerInputSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminBanner> {
    return this.content.updateBanner(
      id,
      body,
      { image: files?.image?.[0]?.buffer, mobileImage: files?.mobileImage?.[0]?.buffer },
      actor,
    );
  }

  @Delete('banners/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeBanner(@Param('id', UuidParam) id: string, @Actor() actor: ActorContext): Promise<void> {
    return this.content.removeBanner(id, actor);
  }

  // ───────────────────────── "Material bo'yicha" tugmalari ─────────────────────────

  @Get('home-collections')
  @ApiOperation({ summary: '"Material bo‘yicha" tugmalari (PPR TRUBA, PVC TRUBA...)' })
  listCollections(): Promise<AdminHomeCollection[]> {
    return this.content.listCollections();
  }

  @Post('home-collections')
  createCollection(
    @ZodBody(homeCollectionInputSchema) body: z.output<typeof homeCollectionInputSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminHomeCollection> {
    return this.content.createCollection(body, actor);
  }

  @Patch('home-collections/:id')
  updateCollection(
    @Param('id', UuidParam) id: string,
    @ZodBody(homeCollectionUpdateSchema) body: z.output<typeof homeCollectionUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminHomeCollection> {
    return this.content.updateCollection(id, body, actor);
  }

  @Delete('home-collections/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCollection(
    @Param('id', UuidParam) id: string,
    @Actor() actor: ActorContext,
  ): Promise<void> {
    return this.content.removeCollection(id, actor);
  }

  @Post('home-collections/:id/image')
  @SingleFileUpload(MAX_IMAGE_BYTES)
  uploadCollectionImage(
    @Param('id', UuidParam) id: string,
    @UploadedFile() file: UploadedFileData | undefined,
    @Actor() actor: ActorContext,
  ): Promise<AdminHomeCollection> {
    if (!file) throw ApiError.badRequest('FILE_INVALID', 'Fayl tanlanmagan');
    return this.content.uploadCollectionImage(id, file.buffer, actor);
  }

  // ─────────────────────────────── Sozlamalar ───────────────────────────────

  @Get('settings')
  getSettings(): Promise<SiteSettings> {
    return this.settings.get();
  }

  @Put('settings/store')
  @ApiOperation({ summary: 'Do‘kon ma’lumotlari: nomi, telefon, manzil, ish vaqti' })
  updateStore(
    @ZodBody(storeSettingsSchema) body: z.output<typeof storeSettingsSchema>,
    @Actor() actor: ActorContext,
  ): Promise<SiteSettings> {
    return this.content.updateStore(body, actor);
  }

  @Put('settings/delivery')
  @ApiOperation({ summary: 'Yetkazib berish: narxi, bepul chegarasi, olib ketish' })
  updateDelivery(
    @ZodBody(deliverySettingsSchema) body: z.output<typeof deliverySettingsSchema>,
    @Actor() actor: ActorContext,
  ): Promise<SiteSettings> {
    return this.content.updateDelivery(body, actor);
  }
}
