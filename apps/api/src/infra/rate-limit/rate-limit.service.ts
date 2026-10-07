import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';
import { type CounterHit, MemoryCounter } from './memory-counter.js';

const KEY_PREFIX = 'rl:';

// INCR + birinchi urinishda muddat belgilash — atomar (bir nechta API nusxasi uchun ham to'g'ri)
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

/**
 * Urinishlarni sanash: Redis bo'lsa unda (barcha API nusxalari uchun umumiy), aks holda xotirada.
 * Redis vaqtincha ishlamasa, so'rovlar to'xtab qolmaydi — xotiradagi hisoblagich ishlatiladi.
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly memory = new MemoryCounter();

  constructor(private readonly redis: RedisService) {}

  onModuleDestroy(): void {
    this.memory.dispose();
  }

  async hit(key: string, windowMs: number): Promise<CounterHit> {
    const client = this.redis.isReady ? this.redis.client : null;
    if (client) {
      try {
        const [count, ttl] = (await client.eval(
          HIT_SCRIPT,
          1,
          KEY_PREFIX + key,
          String(windowMs),
        )) as [number, number];
        return { count, resetInMs: Math.max(0, ttl) };
      } catch (error) {
        this.redis.logError(error as Error);
      }
    }
    return this.memory.hit(key, windowMs);
  }

  async peek(key: string): Promise<CounterHit | null> {
    const client = this.redis.isReady ? this.redis.client : null;
    if (client) {
      try {
        const [value, ttl] = await Promise.all([
          client.get(KEY_PREFIX + key),
          client.pttl(KEY_PREFIX + key),
        ]);
        if (value === null || ttl <= 0) return null;
        return { count: Number(value), resetInMs: ttl };
      } catch (error) {
        this.redis.logError(error as Error);
      }
    }
    return this.memory.peek(key);
  }

  async reset(key: string): Promise<void> {
    this.memory.reset(key);
    const client = this.redis.isReady ? this.redis.client : null;
    if (client) {
      try {
        await client.del(KEY_PREFIX + key);
      } catch (error) {
        this.redis.logError(error as Error);
      }
    }
  }
}
