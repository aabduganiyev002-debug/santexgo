import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AdminBrand, brandInputSchema, brandUpdateSchema, type z } from '@santexgo/shared';
import { Actor, type ActorContext, Roles } from '../../../common/auth/decorators.js';
import { ApiError } from '../../../common/errors/api-error.js';
import {
  MAX_IMAGE_BYTES,
  SingleFileUpload,
  type UploadedFileData,
} from '../../../common/http/uploads.js';
import { UuidParam } from '../../../common/validation/params.js';
import { ZodBody } from '../../../common/validation/zod-validation.js';
import { AdminBrandsService } from './admin-brands.service.js';

@ApiTags('Admin: brendlar')
@Roles('ADMIN')
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(private readonly brands: AdminBrandsService) {}

  @Get()
  @ApiOperation({ summary: 'Barcha brendlar (yashirinlari ham)' })
  list(): Promise<AdminBrand[]> {
    return this.brands.list();
  }

  @Get(':id')
  get(@Param('id', UuidParam) id: string): Promise<AdminBrand> {
    return this.brands.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Brend qo‘shish' })
  create(
    @ZodBody(brandInputSchema) body: z.output<typeof brandInputSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminBrand> {
    return this.brands.create(body, actor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Brendni tahrirlash' })
  update(
    @Param('id', UuidParam) id: string,
    @ZodBody(brandUpdateSchema) body: z.output<typeof brandUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminBrand> {
    return this.brands.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Brendni o‘chirish (mahsulotlari bo‘lmasa)' })
  remove(@Param('id', UuidParam) id: string, @Actor() actor: ActorContext): Promise<void> {
    return this.brands.remove(id, actor);
  }

  @Post(':id/logo')
  @SingleFileUpload(MAX_IMAGE_BYTES)
  @ApiOperation({ summary: 'Logo yuklash (JPG, PNG, WebP; avtomatik WebP 600px)' })
  uploadLogo(
    @Param('id', UuidParam) id: string,
    @UploadedFile() file: UploadedFileData | undefined,
    @Actor() actor: ActorContext,
  ): Promise<AdminBrand> {
    if (!file) throw ApiError.badRequest('FILE_INVALID', 'Fayl tanlanmagan');
    return this.brands.uploadLogo(id, file.buffer, actor);
  }

  @Delete(':id/logo')
  @ApiOperation({ summary: 'Logoni o‘chirish' })
  removeLogo(
    @Param('id', UuidParam) id: string,
    @Actor() actor: ActorContext,
  ): Promise<AdminBrand> {
    return this.brands.removeLogo(id, actor);
  }
}
