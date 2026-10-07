import { describe, expect, it } from 'vitest';
import {
  bannerInputSchema,
  DEFAULT_DELIVERY_SETTINGS,
  deliveryFee,
  storeSettingsSchema,
} from './content-admin.js';

describe('deliveryFee', () => {
  it('chegaradan oshsa bepul, olib ketishda bepul', () => {
    expect(deliveryFee(DEFAULT_DELIVERY_SETTINGS, 500_000, 'DELIVERY')).toBe(30_000);
    expect(deliveryFee(DEFAULT_DELIVERY_SETTINGS, 1_000_000, 'DELIVERY')).toBe(0);
    expect(deliveryFee(DEFAULT_DELIVERY_SETTINGS, 100, 'PICKUP')).toBe(0);
    expect(deliveryFee({ ...DEFAULT_DELIVERY_SETTINGS, freeFrom: null }, 9e6, 'DELIVERY')).toBe(
      30_000,
    );
  });
});

describe('banner va sozlamalar', () => {
  it('banner havolasi: sayt ichidagi yo‘l yoki https', () => {
    expect(bannerInputSchema.parse({ linkUrl: '/brands/plastherm' }).linkUrl).toBe(
      '/brands/plastherm',
    );
    expect(bannerInputSchema.safeParse({ linkUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(bannerInputSchema.parse({ isActive: 'false' }).isActive).toBe(false);
  });

  it('do‘kon telefoni normallashtiriladi', () => {
    expect(storeSettingsSchema.parse({ name: 'SantexGo', phone: '90 123 45 67' }).phone).toBe(
      '+998901234567',
    );
  });
});

describe('banner sanalari', () => {
  it('bo‘sh maydon — sana olib tashlanadi, berilmasa — o‘zgarmaydi', () => {
    expect(bannerInputSchema.parse({ endsAt: '' }).endsAt).toBeNull();
    expect(bannerInputSchema.parse({}).endsAt).toBeUndefined();
    expect(bannerInputSchema.parse({ endsAt: '2026-11-01T00:00:00Z' }).endsAt).toBeInstanceOf(Date);
    expect(bannerInputSchema.safeParse({ endsAt: 'ertaga' }).success).toBe(false);
  });
});
