import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Logger } from '@nestjs/common';
import { assertSafeKey, type PutObjectOptions, StorageDriver } from './storage-driver.js';

export interface S3Options {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/** S3-mos saqlash: Cloudflare R2, AWS S3, SeaweedFS (lokal Docker), MinIO. */
export class S3StorageDriver extends StorageDriver {
  readonly name = 's3';
  private readonly logger = new Logger('S3Storage');
  private readonly client: S3Client;

  constructor(private readonly options: S3Options) {
    super();
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  override async init(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.options.bucket }));
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status !== 404) {
        this.logger.warn(`S3 bucket tekshiruvi: ${(error as Error).message}`);
        return;
      }
      // Lokal SeaweedFS/MinIO'da bucket avtomatik yaratiladi; production'da oldindan yarating
      await this.client.send(new CreateBucketCommand({ Bucket: this.options.bucket }));
      this.logger.log(`S3 bucket yaratildi: ${this.options.bucket}`);
    }
  }

  async put(key: string, body: Buffer, options: PutObjectOptions): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        CacheControl: options.cacheControl,
      }),
    );
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    keys.forEach(assertSafeKey);
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.options.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}
