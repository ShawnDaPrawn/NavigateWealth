// Flat ESLint config (ESLint 10). The project is a Vite + React 18 SPA whose
// Supabase Edge Function source (src/supabase/functions/**) runs under Deno
// (npm:/jsr: specifiers + Deno globals) and therefore needs a separate scope.
//
// Philosophy for the initial landing: turn linting ON with a real-but-lenient
// baseline so `npm run lint` is green and can be gated in CI, while the highest
// volume, non-autofixable rules (no-explicit-any, no-unused-vars, ...) are set
// to "warn" rather than "error". They surface signal for gradual cleanup
// without blocking. Tighten these to "error" over time as the warnings are
// burned down (mirrors the typecheck burn-down approach).
//
// eslint-config-prettier MUST stay last so it disables any stylistic rules that
// would conflict with Prettier (Prettier owns formatting; ESLint owns code quality).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // 1. Global ignores: build output, deps, generated/build artifacts.
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'tmp/**',
      '.claude/**',
      'playwright-report/**',
      'test-results/**',
      '.vercel/**',
      'coverage/**',
      '**/*.d.ts',
      'public/sitemap.xml',
      'seo-route-manifest.json',
    ],
  },

  // 2. Recommended baselines for all source.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 3. Browser SPA (everything under src/ except the Deno edge function).
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/supabase/functions/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Correctness rule — ENFORCED. The original 40 violations were triaged:
      // 10 genuine "hook after early return" bugs were fixed, and the two files
      // that need bigger work (SigningWorkflow.tsx — god-file, Phase 4/5;
      // ContainerBlock.tsx — block-definition `editor` pattern) carry a
      // file-level eslint-disable with a TODO. New violations now fail lint.
      // (Scoped here, not in the global block, because the react-hooks plugin
      // is only registered for the SPA.)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Frontend code should log through `src/utils/logger.ts` (PII-sanitized,
      // env-aware), not raw console. WARN surfaces the existing ~880 calls for
      // gradual burn-down without blocking; `console.warn`/`console.error` are
      // allowed so legitimate error paths don't get flagged. The logger sink
      // itself is exempted below. Promote to "error" once the backlog clears.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Phase 7 boundary guardrail — ENFORCED. Frontend SPA code must not import
      // the Supabase Edge Function (Deno) source at runtime; it calls those
      // routes over HTTP. Type-only imports (shared response types) are allowed,
      // which keeps Deno-only globals / npm:/jsr: specifiers out of the SPA
      // bundle and preserves the client/server boundary the split relies on.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/supabase/functions/**'],
              message:
                'Frontend must not import Supabase Edge Function (Deno) source at runtime — call it over HTTP. Type-only imports are allowed (use `import type`).',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },

  // 4. Supabase Edge Functions — Deno runtime (npm:/jsr: imports, Deno globals).
  {
    files: ['src/supabase/functions/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.deno },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // 5. Node-land: build scripts, root config files, Playwright e2e specs.
  //    Browser globals are included because the provider-portal scripts and the
  //    e2e specs embed Playwright `page.evaluate()` blocks that run in the page
  //    context (document/window/HTMLElement/etc.).
  {
    files: ['scripts/**/*.{js,mjs,cjs}', 'e2e/**/*.{ts,js}', '*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Scripts are not React components and can be arbitrarily large (e.g. the
      // Puppeteer provider-portal worker is 3000+ lines by design). Disable the
      // line-count guard for this scope entirely.
      'max-lines': 'off',
    },
  },

  // 6. Service workers (self/caches/fetch/clients, no DOM).
  {
    files: ['**/service-worker.js', 'public/**/*.js', 'src/public/**/*.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, ...globals.browser },
    },
  },

  // 7. Lenient baseline: downgrade the high-volume / non-autofixable rules to
  //    "warn" so the first landing is green. Promote to "error" incrementally
  //    as each warning bucket is burned down (mirrors the typecheck burn-down).
  {
    rules: {
      // Phase 7 file-size guard — WARN. Lowered 2000 → 1000 (Stage 1) to catch
      // new god-files at PR time. The target ceiling is 600 (Stage 2), to be
      // applied once the in-flight backend/frontend splits (Sessions B, D, E)
      // land and no file exceeds 1000 lines. The files that warn at 1000 today
      // are exactly the ones those splits must decompose. Kept as "warn" (not
      // "error") so the existing backlog doesn't block CI; promote to "error"
      // once the backlog clears. The /scripts/** override (§7c) stays "off".
      'max-lines': ['warn', { max: 1000, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      'no-useless-catch': 'warn',
      'no-case-declarations': 'warn',
      'no-constant-condition': 'warn',
      'no-control-regex': 'warn',
      'no-irregular-whitespace': 'warn',
      'prefer-const': 'warn',
      // ESLint 10 promoted these to the recommended set; they fire in volume on
      // never-linted code. Keep as warnings for the initial landing.
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',
    },
  },

  // 7b. The logger is the sanctioned console sink — it is the implementation
  //     that everything else routes through, so raw console is intentional here.
  {
    files: ['src/utils/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // 7c. Scripts are not React components; they can be arbitrarily large.
  //     This override must come after the global rules block (7) that sets
  //     the max-lines limit so it wins in flat-config precedence.
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    rules: {
      'max-lines': 'off',
    },
  },

  // 8. Disable stylistic rules that conflict with Prettier. Keep LAST.
  eslintConfigPrettier,
);
