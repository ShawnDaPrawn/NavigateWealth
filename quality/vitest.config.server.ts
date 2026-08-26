import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import baseConfig from '../vitest.config';

/**
 * Backend (Supabase Edge Function) coverage config — Stage A / F4.
 *
 * WHY THIS EXISTS
 * ---------------
 * `vitest.config.ts` excludes `src/supabase/functions/**` from coverage
 * entirely, so the ~136K-line Deno backend — the layer holding auth decisions,
 * client PII, e-signatures and money movement — had NO coverage measurement at
 * all. Its tests ran and counted toward the headline test total, but nothing
 * measured or floored what they actually covered, and the single blended "~31%"
 * silently described the SPA only.
 *
 * You cannot ratchet what you do not measure. This config measures the backend
 * on its own, so SPA and backend are reported and floored as two numbers rather
 * than one misleading average.
 *
 * FIRST HONEST MEASUREMENT (2026-08-21, 573 backend tests):
 *   statements 13.43%   branches 9.38%   functions 12.88%   lines 13.79%
 * CURRENT (2026-08-21, 608 backend tests — after PR #207's security tests and
 * the lazy-router suite landed):
 *   statements 13.74%   branches 9.80%   functions 13.48%   lines 14.11%
 *
 * The floors below sit just under those, matching the ratchet convention used
 * everywhere else in this repo: coverage can only go up. Raise them as backend
 * tests land — contract tests in the `esign-routes.contract.test.ts` style are
 * the highest-value way to move this number. The small gap (~0.1pt) is
 * deliberate headroom: an exact floor turns an unrelated refactor that deletes
 * a few uncovered lines into a CI failure.
 *
 * Run:  npm run test:coverage:server
 * The SPA equivalent is `npm test -- --coverage` (vitest.config.ts).
 *
 * NOTE ON COMPOSITION — do not "simplify" this to `mergeConfig(baseConfig, …)`.
 * Vite's `mergeConfig` CONCATENATES arrays, so `test.include` would become the
 * base's SPA glob PLUS this one, quietly running the entire 6,842-test SPA
 * suite on every backend-coverage run (~6 minutes instead of ~20 seconds) while
 * still reporting backend-only coverage numbers. The aliases are reused
 * explicitly instead; they are required for the Deno `npm:`/`jsr:` specifiers
 * in edge modules to resolve under Node at all.
 */
export default defineConfig({
  plugins: [react()],
  resolve: baseConfig.resolve,
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    testTimeout: 15000,
    // Backend suites ONLY — the SPA suites are measured by vitest.config.ts.
    include: ['src/supabase/functions/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'scripts/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage-server',
      include: ['src/supabase/functions/**/*.{ts,tsx}'],
      exclude: [
        'src/supabase/functions/**/__tests__/**',
        'src/supabase/functions/**/*.test.{ts,tsx}',
        'src/supabase/functions/**/*.spec.{ts,tsx}',
      ],
      // Floors set just below the current measurement. Ratchet UP only.
      //
      // Raised 2026-08-23 (13.6 / 9.7 / 13.3 / 14.0) after the WS0 security
      // work brought the measurement to 15.11 / 10.75 / 14.91 / 15.52 across
      // 798 tests. Lifting the floor in the same change is the point of the
      // ratchet: a coverage gain that is not floored is a gain the next PR can
      // silently give back.
      //
      // Raised again 2026-08-24 (15.0 / 10.6 / 14.8 / 15.4) with the A18
      // entry-point extraction. Measured 17.39 / 12.62 / 16.95 / 17.86 across
      // 912 tests — of which the create-app suite contributed
      // +0.16 / +0.11 / +0.20 / +0.15; the rest was slack the intervening PRs
      // gained and never claimed, which is exactly what this comment exists to
      // stop happening twice.
      //
      // Raised again 2026-08-25 (17.3 / 12.5 / 16.8 / 17.7) with the first two
      // §8.2 route-family contract suites — resources-routes (the public
      // legal-document read next to admin writes) and tasks-routes (247
      // statements behind a single router-scope guard). Measured
      // 17.70 / 12.92 / 17.23 / 18.18 across 949 tests.
      //
      // Raised again 2026-08-26 (17.6 / 12.8 / 17.1 / 18.0) with the
      // advice-engine-roa-routes contract suite — 286 statements that were
      // entirely uncovered, behind a four-predicate authorization matrix.
      // Measured 18.33 / 13.25 / 17.81 / 18.84 across 1,035 tests.
      //
      // Raised again 2026-08-26 (18.2 / 13.1 / 17.7 / 18.7) with the
      // advice-engine-fna-routes contract suite — 27 routes across six FNA
      // families sharing one client-access policy, table-driven so no family
      // can quietly lose its check. Measured 19.02 / 13.46 / 18.37 / 19.50
      // across 1,320 tests.
      thresholds: {
        statements: 18.9,
        branches: 13.3,
        functions: 18.2,
        lines: 19.3,
      },
    },
  },
});
