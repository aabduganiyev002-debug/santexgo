import { Injectable } from '@nestjs/common';
import {
  DEFAULT_DELIVERY_SETTINGS,
  DEFAULT_STORE_SETTINGS,
  type DeliverySettings,
  deliverySettingsSchema,
  type SiteSettings,
  type StoreSettings,
  storeSettingsSchema,
} from '@santexgo/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

const TTL_MS = 30_000;

/**
 * Sayt sozlamalari (settings jadvali): do'kon ma'lumotlari va yetkazib berish qoidalari.
 * Bazadagi qiymat buzilgan bo'lsa ham sayt ishlashda davom etadi — standart qiymat olinadi.
 */
@Injectable()
export class SettingsService {
  private cached: { value: Promise<SiteSettings>; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  get(): Promise<SiteSettings> {
    if (!this.cached || this.cached.expiresAt <= Date.now()) {
      const entry = { value: this.load(), expiresAt: Date.now() + TTL_MS };
      entry.value.catch(() => {
        if (this.cached === entry) this.cached = null;
      });
      this.cached = entry;
    }
    return this.cached.value;
  }

  async delivery(): Promise<DeliverySettings> {
    return (await this.get()).delivery;
  }

  async updateStore(store: StoreSettings): Promise<SiteSettings> {
    await this.save('store', store);
    return this.get();
  }

  async updateDelivery(delivery: DeliverySettings): Promise<SiteSettings> {
    await this.save('delivery', delivery);
    return this.get();
  }

  private async save(key: string, value: object): Promise<void> {
    const json = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
    await this.prisma.setting.upsert({
      where: { key },
      update: { value: json },
      create: { key, value: json },
    });
    this.cached = null;
  }

  private async load(): Promise<SiteSettings> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: ['store', 'delivery'] } },
    });
    const raw = new Map(rows.map((r) => [r.key, r.value]));
    const store = storeSettingsSchema.safeParse({
      ...DEFAULT_STORE_SETTINGS,
      ...(raw.get('store') as object | undefined),
    });
    const delivery = deliverySettingsSchema.safeParse({
      ...DEFAULT_DELIVERY_SETTINGS,
      ...(raw.get('delivery') as object | undefined),
    });
    return {
      store: store.success ? (store.data as StoreSettings) : DEFAULT_STORE_SETTINGS,
      delivery: delivery.success ? (delivery.data as DeliverySettings) : DEFAULT_DELIVERY_SETTINGS,
    };
  }
}
