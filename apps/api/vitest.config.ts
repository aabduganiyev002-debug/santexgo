import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Unit testlar: bazasiz, tez. NestJS dekoratorlari metadata'si uchun SWC ishlatiladi.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'src/**/*.e2e.test.ts'],
  },
});
