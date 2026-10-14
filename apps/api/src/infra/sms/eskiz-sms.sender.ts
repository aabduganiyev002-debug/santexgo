import { Logger } from '@nestjs/common';
import { maskUzPhone } from '@santexgo/shared';
import { SmsProviderError, SmsSender } from './sms-sender.js';

const BASE_URL = 'https://notify.eskiz.uz/api';
const REQUEST_TIMEOUT_MS = 10_000;

export interface EskizOptions {
  email: string;
  password: string;
  /** Jo'natuvchi nomi yoki raqami (Eskiz kabinetida tasdiqlangan) */
  from: string;
  fetch?: typeof fetch;
}

interface EskizTokenResponse {
  data?: { token?: string };
}

/**
 * Eskiz.uz SMS shlyuzi. Diqqat: Eskiz faqat kabinetda oldindan tasdiqlangan shablon
 * bo'yicha matn yuboradi — SMS matnlari (modules/auth/sms-messages.ts) shablonga mos bo'lishi kerak.
 */
export class EskizSmsSender extends SmsSender {
  readonly name = 'eskiz';
  private readonly logger = new Logger('EskizSms');
  private token: string | null = null;
  private readonly http: typeof fetch;

  constructor(private readonly options: EskizOptions) {
    super();
    this.http = options.fetch ?? fetch;
  }

  async send(phone: string, message: string): Promise<void> {
    const body = new URLSearchParams({
      mobile_phone: phone.replace(/^\+/, ''),
      message,
      from: this.options.from,
    });
    let response = await this.request('/message/sms/send', body, await this.getToken());
    if (response.status === 401) {
      // Token muddati tugagan — qayta olib, bir marta takrorlaymiz
      this.token = null;
      response = await this.request('/message/sms/send', body, await this.getToken());
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(
        `SMS yuborilmadi (${maskUzPhone(phone)}): HTTP ${response.status} ${text.slice(0, 300)}`,
      );
      throw new SmsProviderError(`Eskiz HTTP ${response.status}`, response.status);
    }
  }

  private async getToken(): Promise<string> {
    if (this.token) return this.token;
    const response = await this.request(
      '/auth/login',
      new URLSearchParams({ email: this.options.email, password: this.options.password }),
    );
    if (!response.ok) {
      this.logger.error(`Eskiz'ga kirib bo'lmadi: HTTP ${response.status}`);
      throw new SmsProviderError(`Eskiz login HTTP ${response.status}`, response.status);
    }
    const json = (await response.json()) as EskizTokenResponse;
    const token = json.data?.token;
    if (!token) throw new SmsProviderError('Eskiz javobida token yo‘q');
    this.token = token;
    return token;
  }

  private async request(path: string, body: URLSearchParams, token?: string): Promise<Response> {
    try {
      return await this.http(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new SmsProviderError(`Eskiz bilan ulanib bo'lmadi: ${(error as Error).message}`);
    }
  }
}
