// Flat ESLint config for Navigate Wealth.
//
// Scope: the browser React SPA under `src/`. The Deno-based Supabase Edge
// Function code (`src/supabase/functions/**`, `supabase/functions/**`), the
// Node build/utility scripts (`scripts/**`), Playwright specs (`e2e/**`), and
// `middleware.ts` (Vercel Edge) use different globals/module resolution, so
// they are intentionally excluded here to avoid false positives. They remain
// covered by `tsc` (typecheck) where applicable.
//
// Posture: introduced on a large existing codebase (~1,500 source files).
// Stylistic and low-severity rules are set to `warn` so the lint gate can be
// adopted incrementally without a mass rewrite, then ratcheted to `error` over
// time. See docs/PRODUCTION-READINESS.md Section 4.2.
//
// NOTE: `.mjs` is used (matching the repo's existing `scripts/*.mjs`
// convention) because package.json has no `"type": "module"`.

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    // Not linted by this config.
    ignores: [
      'dist/**',
      'dist-ssr/**',
      'build/**',
      'node_modules/**',
      'public/**',
      'coverage/**',
      'tmp/**',
      'e2e/**',
      'scripts/**',
      'supabase/functions/**',
      'src/supabase/functions/**',
      // Generated/vendored embedded font data (huge base64 literals), if any.
      'src/utils/pdf/fonts/**',
      '**/*.config.{js,ts,mjs,cjs}',
      'middleware.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // React rules.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // TypeScript already resolves identifiers/types; the core `no-undef`
      // rule produces false positives on TS and is disabled per the
      // typescript-eslint recommendation.
      'no-undef': 'off',

      // High-value correctness rules kept as errors.
      'no-debugger': 'error',

      // Tuned down for incremental adoption on the existing tree. None of these
      // are caught by `tsc`; ratchet each to 'error' as it reaches zero.
      'no-var': 'warn',
      'prefer-const': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      'no-control-regex': 'warn',
      'no-case-declarations': 'warn',
      'no-fallthrough': 'warn',
      'no-prototype-builtins': 'warn',
      'no-misleading-character-class': 'warn',
      'no-useless-catch': 'warn',
      'no-empty-pattern': 'warn',
    },
  },
);
