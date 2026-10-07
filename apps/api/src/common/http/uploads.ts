import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGES_PER_UPLOAD = 10;

export interface UploadedFileData {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/** Bitta fayl ("file" maydoni) — xotirada qabul qilinadi, hajmi cheklangan. */
export function SingleFileUpload(maxBytes: number, extraFields: Record<string, object> = {}) {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor('file', { limits: { fileSize: maxBytes, files: 1, fields: 10 } }),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: { file: { type: 'string', format: 'binary' }, ...extraFields },
      },
    }),
  );
}

/** Bir nechta rasm ("files" maydoni). */
export function MultipleImagesUpload() {
  return applyDecorators(
    UseInterceptors(
      FilesInterceptor('files', MAX_IMAGES_PER_UPLOAD, {
        limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES_PER_UPLOAD },
      }),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['files'],
        properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } },
      },
    }),
  );
}
