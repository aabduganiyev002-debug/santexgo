/**
 * SMS yuborish provayderi. Yangi provayder (Play Mobile, Getsms...) qo'shish uchun
 * shu klassdan meros olgan klass yozish va SmsModule'da ulash kifoya.
 */
export abstract class SmsSender {
  abstract readonly name: string;
  /** phone — E.164 formatda (+998901234567). Xato bo'lsa, istisno tashlaydi. */
  abstract send(phone: string, message: string): Promise<void>;
}

export class SmsProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SmsProviderError';
  }
}
