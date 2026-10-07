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
import {
  type AdminCategory,
  categoryInputSchema,
  categoryUpdateSchema,
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
import { ZodBody } from '../../../common/validation/zod-validation.js';
import { AdminCategoriesService } from './admin-categories.service.js';

@ApiTags('Admin: kategoriyalar')
@Roles('ADMIN')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Barcha kategoriyalar (daraxt tartibida, chuqurlik bilan)' })
  list(): Promise<AdminCategory[]> {
    return this.categories.list();
  }

  @Get(':id')
  get(@Param('id', UuidParam) id: string): Promise<AdminCategory> {
    return this.categories.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Kategoriya yoki subkategoriya (parentId bilan) yaratish' })
  create(
    @ZodBody(categoryInputSchema) body: z.output<typeof categoryInputSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminCategory> {
    return this.categories.create(body, actor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Tahrirlash (yashirilsa — ichki kategoriyalari ham yashiriladi)' })
  update(
    @Param('id', UuidParam) id: string,
    @ZodBody(categoryUpdateSchema) body: z.output<typeof categoryUpdateSchema>,
    @Actor() actor: ActorContext,
  ): Promise<AdminCategory> {
    return this.categories.update(id, body, actor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'O‘chirish (mahsulot va ichki kategoriyasi bo‘lmasa)' })
  remove(@Param('id', UuidParam) id: string, @Actor() actor: ActorContext): Promise<void> {
    return this.categories.remove(id, actor);
  }

  @Post(':id/image')
  @SingleFileUpload(MAX_IMAGE_BYTES)
  @ApiOperation({ summary: 'Kategoriya rasmini yuklash' })
  uploadImage(
    @Param('id', UuidParam) id: string,
    @UploadedFile() file: UploadedFileData | undefined,
    @Actor() actor: ActorContext,
  ): Promise<AdminCategory> {
    if (!file) throw ApiError.badRequest('FILE_INVALID', 'Fayl tanlanmagan');
    return this.categories.uploadImage(id, file.buffer, actor);
  }

  @Delete(':id/image')
  removeImage(
    @Param('id', UuidParam) id: string,
    @Actor() actor: ActorContext,
  ): Promise<AdminCategory> {
    return this.categories.removeImage(id, actor);
  }
}
