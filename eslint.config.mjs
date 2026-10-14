import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const WEB_APPS = [
  'apps/web/**/*.{ts,tsx}',
  'apps/admin/**/*.{ts,tsx}',
  'packages/ui/**/*.{ts,tsx}',
];

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/generated/**',
    '**/next-env.d.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // Next.js ilovalari va umumiy UI paketi: brauzer muhiti, React hook qoidalari, Next.js tavsiyalari
    files: WEB_APPS,
    plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    settings: { next: { rootDir: ['apps/web/', 'apps/admin/'] } },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  {
    // Terminal uchun yordamchi skriptlar: ekranga chiqarish — ularning asosiy vazifasi
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
);
