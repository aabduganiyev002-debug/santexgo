import path from 'node:path';
import type { NextConfig } from 'next';

/** API manzili server tomondan (Docker ichida: http://api:4000) */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
];

const nextConfig: NextConfig = {
  // Docker uchun: faqat kerakli fayllar bilan mustaqil server (.next/standalone)
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  poweredByHeader: false,
  reactStrictMode: true,
  // Umumiy UI paketi TypeScript manbasi sifatida eksport qilinadi — shu yerda kompilyatsiya qilinadi
  transpilePackages: ['@santexgo/ui'],
  // Rasmlar API'da allaqachon WebP va kerakli o'lchamlarda tayyorlanadi
  images: { unoptimized: true },
  // Brauzer API'ga sayt manzili orqali murojaat qiladi (/api/...) — bitta domen, CORS kerak emas.
  // Production'da /api ni Caddy to'g'ridan-to'g'ri API'ga yuboradi; bu qoida zaxira sifatida qoladi.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_INTERNAL_URL}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
