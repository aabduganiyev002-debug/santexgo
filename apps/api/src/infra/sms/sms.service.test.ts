import { HttpStatus } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../common/errors/api-error.js';
import type { Env } from '../../config/env.schema.js';
import type { RateLimitService } from '../rate-limit/rate-limit.service.js';
import { ConsoleSmsSender } from './console-sms.sender.js';
import { DisabledSmsSender } from './disabled-sms.sender.js';
import type { SmsSender } from './sms-sender.js';
import { SmsService } from './sms.service.js';

function createService(sender: SmsSender) {
  const counters = { hit: vi.fn().mockResolvedValue({ count: 1 }) };
  const config = {
    get: (key: keyof Env) =>
      ({ SMS_DAILY_LIMIT: 2000, APP_TIMEZONE: 'Asia/Tashkent' })[key as string],
  };
  const service = new SmsService(
    sender,
    counters as unknown as RateLimitService,
    config as unknown as ConfigService<Env, true>,
  );
  return { service, counters };
}

describe('SmsService', () => {
  it('xabarni provayder orqali yuboradi', async () => {
    const sender = new ConsoleSmsSender();
    const { service } = createService(sender);
    expect(service.enabled).toBe(true);
    await service.send('+998901234567', 'Kod: 123456');
    expect(sender.lastMessageTo('+998901234567')).toBe('Kod: 123456');
  });

  it('SMS xizmati ulanmagan bo‘lsa (SMS_PROVIDER=none) — tushunarli xato, limit sarflanmaydi', async () => {
    const { service, counters } = createService(new DisabledSmsSender());
    expect(service.enabled).toBe(false);
    const error = await service.send('+998901234567', 'Kod: 123456').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('SMS_SEND_FAILED');
    expect((error as ApiError).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect((error as ApiError).message).toMatch(/qo‘ng‘iroq/);
    expect(counters.hit).not.toHaveBeenCalled();
  });
});
