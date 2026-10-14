import type { VerificationPurpose } from '../../generated/prisma/client.js';

/**
 * SMS matnlari. Faqat lotin harflari va ASCII belgilar: aks holda SMS Unicode'da ketadi
 * va bitta xabarga 160 emas, 70 belgi sig'adi (narx 2 baravar oshadi).
 * Eskiz.uz ishlatilsa, har bir matn kabinetda shablon sifatida tasdiqlangan bo'lishi kerak.
 */
export const VERIFICATION_SMS: Record<VerificationPurpose, (code: string) => string> = {
  REGISTER: (code) => `SantexGo: ro'yxatdan o'tish kodi ${code}. Kodni hech kimga bermang.`,
  RESET_PASSWORD: (code) => `SantexGo: parolni tiklash kodi ${code}. Kodni hech kimga bermang.`,
  CHANGE_PHONE: (code) =>
    `SantexGo: telefon raqamini tasdiqlash kodi ${code}. Kodni hech kimga bermang.`,
};
