import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RateLimitService } from './rate-limit.service.js';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const toSeconds = (ms: number): number => Math.max(1, Math.ceil(ms / 1000));

/** @nestjs/throttler uchun saqlash joyi: RateLimitService (Redis yoki xotira) ustida. */
@Injectable()
export class ThrottlerStorageAdapter implements ThrottlerStorage {
  constructor(private readonly counters: RateLimitService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const blockKey = `throttle-block:${throttlerName}:${key}`;
    const block = await this.counters.peek(blockKey);
    if (block) {
      const seconds = toSeconds(block.resetInMs);
      return {
        totalHits: limit + 1,
        timeToExpire: seconds,
        isBlocked: true,
        timeToBlockExpire: seconds,
      };
    }

    const hit = await this.counters.hit(`throttle:${throttlerName}:${key}`, ttl);
    const isBlocked = hit.count > limit;
    let timeToBlockExpire = 0;
    if (isBlocked) {
      const duration = Math.max(blockDuration, hit.resetInMs);
      await this.counters.hit(blockKey, duration);
      timeToBlockExpire = toSeconds(duration);
    }
    return {
      totalHits: hit.count,
      timeToExpire: toSeconds(hit.resetInMs),
      isBlocked,
      timeToBlockExpire,
    };
  }
}
