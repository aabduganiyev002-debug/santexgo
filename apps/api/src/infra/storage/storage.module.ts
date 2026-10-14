import path from 'node:path';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { LocalStorageDriver } from './local-storage.driver.js';
import { MediaService } from './media.service.js';
import { S3StorageDriver } from './s3-storage.driver.js';
import { StorageDriver } from './storage-driver.js';

export function localStorageDir(config: ConfigService<Env, true>): string {
  return path.resolve(config.get('STORAGE_LOCAL_DIR', { infer: true }));
}

@Global()
@Module({
  providers: [
    {
      provide: StorageDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): StorageDriver => {
        if (config.get('STORAGE_DRIVER', { infer: true }) === 's3') {
          return new S3StorageDriver({
            endpoint: config.get('S3_ENDPOINT', { infer: true }),
            region: config.get('S3_REGION', { infer: true }),
            bucket: config.get('S3_BUCKET', { infer: true })!,
            accessKeyId: config.get('S3_ACCESS_KEY', { infer: true })!,
            secretAccessKey: config.get('S3_SECRET_KEY', { infer: true })!,
            forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
          });
        }
        return new LocalStorageDriver(localStorageDir(config));
      },
    },
    MediaService,
  ],
  exports: [MediaService, StorageDriver],
})
export class StorageModule {}
