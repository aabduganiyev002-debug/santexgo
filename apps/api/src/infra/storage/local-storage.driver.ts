import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertSafeKey, type PutObjectOptions, StorageDriver } from './storage-driver.js';

/**
 * Fayllar serverning diskida saqlanadi va API orqali /api/media/... manzilida beriladi.
 * Lokal ishlab chiqish va bitta serverli kichik deploy uchun.
 */
export class LocalStorageDriver extends StorageDriver {
  readonly name = 'local';

  constructor(readonly rootDir: string) {
    super();
  }

  override async init(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async put(key: string, body: Buffer, _options: PutObjectOptions): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async delete(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(this.resolve(key), { force: true })));
  }

  private resolve(key: string): string {
    assertSafeKey(key);
    const file = path.resolve(this.rootDir, key);
    if (!file.startsWith(path.resolve(this.rootDir) + path.sep)) {
      throw new Error(`Noto‘g‘ri fayl kaliti: ${key}`);
    }
    return file;
  }
}
