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
      'coverage-server/**',
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
          // ONE-WAY-TO-DO-IT bans (Stage A / F10). Only rules that are already
          // at ZERO belong here, so they can be `error` with no debt.
          paths: [
            {
              name: 'react-toastify',
              message:
                'Use `import { toast } from "sonner"` — sonner is the app\'s toast system and its <Toaster> is the only one mounted (AppProviders.tsx). react-toastify toasts silently DO NOTHING: no <ToastContainer> is rendered anywhere and its CSS is never imported, so every call was a no-op. This bit ReminderSettingsPanel, where admins saving e-sign reminder settings got no success or failure feedback at all.',
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

  // 5. Node-land: build scripts, config files (root and quality/), Playwright
  //    e2e specs. Browser globals are included because the provider-portal
  //    scripts and the e2e specs embed Playwright `page.evaluate()` blocks that
  //    run in the page context (document/window/HTMLElement/etc.).
  //
  //    `*.{js,mjs,cjs,ts}` matches the repo root only, so tool configs that live
  //    in quality/ need their own pattern — without it a CommonJS config there
  //    loses `module`/`require` and fails no-undef.
  {
    files: [
      'scripts/**/*.{js,mjs,cjs}',
      'e2e/**/*.{ts,js}',
      '*.{js,mjs,cjs,ts}',
      'quality/**/*.{js,mjs,cjs,ts}',
    ],
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

  // 7d. TYPE-AWARE rules (Stage A / F5) — core logic layers only.
  //
  //     `no-floating-promises` / `no-misused-promises` need type information,
  //     which means a second, slower parse backed by a real tsconfig. They are
  //     the only rules here that can catch an unawaited promise — a live bug
  //     class in an async-heavy codebase, and one nothing else gates.
  //
  //     SCOPE, AND WHY IT IS NOT REPO-WIDE YET. Measured 2026-08-21 across the
  //     whole SPA: 1,197 violations. They are almost entirely in
  //     src/components/ (577 floating + 610 misused = 1,187) — overwhelmingly
  //     `onClick={async () => …}`-style handlers, which are real but
  //     low-severity and far too numerous to fix in one pass. The core logic
  //     layers below had just 10, all `no-floating-promises`, all
  //     fire-and-forget refreshes in useSecuritySettings.ts (9) and
  //     useFnaBatchStatus.ts (1). Those were fixed with an explicit `void`, so
  //     this scope is at ZERO and the rules land as `error` — a real gate with
  //     no debt, rather than another warn-baseline nobody reads.
  //
  //     EXPANSION PATH: add 'src/components/**' here once that 1,187 backlog is
  //     burned down (start with no-floating-promises, which is the higher-value
  //     half), then extend to the Deno edge source — that needs its own
  //     tsconfig first, since tsconfig.typecheck.json deliberately excludes it.
  //
  //     Cost: ~10s over this scope. A repo-wide type-aware pass measured ~83s.
  {
    files: [
      'src/utils/**/*.ts',
      'src/hooks/**/*.ts',
      'src/shared/**/*.{ts,tsx}',
      'src/services/**/*.ts',
      'src/config/**/*.ts',
      'src/router/**/*.tsx',
    ],
    // Tests deliberately float promises; keep the gate on production code.
    ignores: ['**/*.test.{ts,tsx}', '**/__tests__/**'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.typecheck.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // 8. Disable stylistic rules that conflict with Prettier. Keep LAST.
  eslintConfigPrettier,
);
