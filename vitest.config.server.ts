import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import baseConfig from './vitest.config';

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
 *
 * The floors below sit just under those, matching the ratchet convention used
 * everywhere else in this repo: coverage can only go up. Raise them as backend
 * tests land — contract tests in the `esign-routes.contract.test.ts` style are
 * the highest-value way to move this number.
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
      // Floors set just below the 2026-08-21 measurement. Ratchet UP only.
      thresholds: {
        statements: 13.0,
        branches: 9.0,
        functions: 12.5,
        lines: 13.3,
      },
    },
  },
});
