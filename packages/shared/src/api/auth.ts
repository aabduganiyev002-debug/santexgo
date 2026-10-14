export const USER_ROLES = ['CUSTOMER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Cookie nomlari (API o'rnatadi, frontend faqat "hint" cookie'ni o'qiy oladi). HTTPS'da
 * (production) nomlar oldiga HOST_COOKIE_PREFIX qo'shiladi — apps/api/.../auth.cookies.ts
 */
export const AUTH_COOKIES = {
  /** Access token (JWT, 15 daqiqa) — httpOnly */
  access: 'sg_at',
  /** Refresh token (30 kun) — httpOnly; lokal HTTP'da faqat /api/v1/auth yo'lida yuboriladi */
  refresh: 'sg_rt',
  /** "Kirgan" belgisi — JavaScript va Next.js middleware uchun, maxfiy ma'lumot yo'q */
  hint: 'sg_auth',
} as const;

/**
 * `__Host-` prefiksli cookie'ni brauzer faqat shu hostning o'zidan (Secure, Path=/, Domain'siz)
 * qabul qiladi: qo'shni subdomendagi sayt uni o'rnata yoki almashtira olmaydi
 */
export const HOST_COOKIE_PREFIX = '__Host-';

/** "Kirgan" belgisi cookie'sining mumkin bo'lgan nomlari: production (HTTPS) va lokal (HTTP) */
export const AUTH_HINT_COOKIE_NAMES = [
  `${HOST_COOKIE_PREFIX}${AUTH_COOKIES.hint}`,
  AUTH_COOKIES.hint,
] as const;

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
