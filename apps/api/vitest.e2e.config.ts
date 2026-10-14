import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// E2E testlar: haqiqiy PostgreSQL bazasi bilan (DATABASE_URL), butun API ishga tushiriladi.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.e2e.test.ts'],
    setupFiles: ['test/setup-env.ts'],
    // Testlar bitta baza bilan ishlaydi — ketma-ket bajariladi
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
