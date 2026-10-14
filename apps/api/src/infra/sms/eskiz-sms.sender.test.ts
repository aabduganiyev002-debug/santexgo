import { describe, expect, it, vi } from 'vitest';
import { EskizSmsSender } from './eskiz-sms.sender.js';
import { SmsProviderError } from './sms-sender.js';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('EskizSmsSender', () => {
  it('token oladi va raqamni + belgisisiz yuboradi', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { token: 't1' } }))
      .mockResolvedValueOnce(json(200, { id: '1', status: 'waiting' }));
    const sender = new EskizSmsSender({
      email: 'a@b.uz',
      password: 'p',
      from: '4546',
      fetch: fetchMock,
    });

    await sender.send('+998901234567', 'Salom');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe('https://notify.eskiz.uz/api/message/sms/send');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer t1');
    const body = init?.body as URLSearchParams;
    expect(body.get('mobile_phone')).toBe('998901234567');
    expect(body.get('message')).toBe('Salom');
    expect(body.get('from')).toBe('4546');
  });

  it('token eskirgan bo‘lsa (401) qayta oladi va takrorlaydi', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { token: 'old' } }))
      .mockResolvedValueOnce(json(401, { message: 'Expired' }))
      .mockResolvedValueOnce(json(200, { data: { token: 'new' } }))
      .mockResolvedValueOnce(json(200, { status: 'waiting' }));
    const sender = new EskizSmsSender({
      email: 'a@b.uz',
      password: 'p',
      from: '4546',
      fetch: fetchMock,
    });

    await sender.send('+998901234567', 'Salom');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const lastInit = fetchMock.mock.calls[3]![1];
    expect((lastInit?.headers as Record<string, string>).Authorization).toBe('Bearer new');
  });

  it('xato javobda SmsProviderError tashlaydi', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(200, { data: { token: 't' } }))
      .mockResolvedValueOnce(json(400, { message: 'bad' }));
    const sender = new EskizSmsSender({
      email: 'a@b.uz',
      password: 'p',
      from: '4546',
      fetch: fetchMock,
    });
    await expect(sender.send('+998901234567', 'Salom')).rejects.toBeInstanceOf(SmsProviderError);
  });
});
