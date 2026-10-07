export const USER_ROLES = ['CUSTOMER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Cookie nomlari (API o'rnatadi, frontend faqat "hint" cookie'ni o'qiy oladi). */
export const AUTH_COOKIES = {
  /** Access token (JWT, 15 daqiqa) — httpOnly */
  access: 'sg_at',
  /** Refresh token (30 kun) — httpOnly, faqat /api/v1/auth yo'lida yuboriladi */
  refresh: 'sg_rt',
  /** "Kirgan" belgisi — JavaScript va Next.js middleware uchun, maxfiy ma'lumot yo'q */
  hint: 'sg_auth',
} as const;

/** Mobil ilova yoki bot: tokenlarni cookie o'rniga javob tanasida olish uchun sarlavha. */
export const AUTH_MODE_HEADER = 'x-auth-mode';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
}

export interface AuthResponse {
  user: AuthUser;
  accessTokenExpiresAt: string;
  /** Faqat "x-auth-mode: token" rejimida */
  accessToken?: string;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
}

export interface SendCodeResponse {
  /** Kod necha soniya amal qiladi */
  expiresIn: number;
  /** Necha soniyadan keyin qayta yuborish mumkin */
  resendIn: number;
}

/** SMS kod va sessiya qoidalari (server va frontend uchun bir xil). */
export const AUTH_LIMITS = {
  codeTtlSeconds: 300,
  codeResendSeconds: 60,
  codeMaxAttempts: 5,
  codesPerPhonePerHour: 5,
} as const;
