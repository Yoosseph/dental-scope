/**
 * Flat ESLint config. Run with `npm run lint` (or `npx eslint .`).
 *
 * `typescript-eslint` cannot load TypeScript 7 (the native port ships no API
 * yet), so `typescript` is aliased to `@typescript/typescript6` in package.json
 * while `@typescript/native` keeps `tsc` at 7.0.2. Type-aware rules read
 * `tsconfig.eslint.json`, which — unlike `tsconfig.json` — also covers tests
 * and `vite.config.ts`.
 */
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  {
    ignores: ['dist/**', 'public/**', 'tools/pipeline/.cache/**', 'docs/**'],
  },
  js.configs.recommended,
  {
    // Node-side files: build scripts, config and the asset pipeline.
    files: ['**/*.mjs', 'vite.config.ts'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `strict` + `noUnusedLocals` already cover most of this; keep the few
      // rules that genuinely add something on top of tsc.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  {
    // Tests run in Node (vitest, `environment: 'node'`).
    files: ['**/*.test.ts', 'tools/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Playwright capture script: a Node process running browser-context code
    // inside `page.evaluate` (window/document plus the `ds` debug global).
    files: ['tools/capture_tooth_review.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ds: 'readonly' },
    },
  },
);
