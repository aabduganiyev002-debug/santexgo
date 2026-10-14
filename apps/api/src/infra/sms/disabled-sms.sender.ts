import { SmsProviderError, SmsSender } from './sms-sender.js';

/**
 * SMS xizmati hali ulanmagan (SMS_PROVIDER=none, masalan Eskiz akkaunti hali ochilmagan):
 * hech narsa yuborilmaydi. Sayt va admin panel ishlaydi; SMS kod talab qiladigan amallarda
 * SmsService foydalanuvchiga tushunarli xato qaytaradi.
 */
export class DisabledSmsSender extends SmsSender {
  readonly name = 'none';

  send(): Promise<void> {
    return Promise.reject(new SmsProviderError('SMS xizmati ulanmagan (SMS_PROVIDER=none)'));
  }
}
