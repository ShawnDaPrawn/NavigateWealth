import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

/**
 * Vitest configuration (Phase 1 / Phase 4 — Guidelines §15).
 *
 * - Uses jsdom for React component testing.
 * - Coverage uses v8; thresholds start moderate (Phase 1) and tighten in
 *   Phase 4 once the suite is fleshed out. Coverage runs in CI via the
 *   "Run coverage (non-blocking baseline)" step in
 *   .github/workflows/quality-check.yml. That step is intentionally
 *   non-blocking until the suite clears these floors, at which point its exit
 *   code should be added to the "Enforce quality gates" step (mirroring the
 *   typecheck burn-down pattern).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Deno edge-function specifiers, rewritten so Vitest (Node) can resolve
      // them; edge test files `vi.mock(...)` these so no real network calls run.
      'pdf-lib@1.17.1': 'pdf-lib',
      'npm:pdf-lib@1.17.1': 'pdf-lib',
      'npm:docx': 'docx',
      'npm:zod': 'zod',
      'npm:hono': 'hono',
      'node-forge@1.3.1': 'node-forge',
      '@jsr/supabase__supabase-js@2.49.8': '@jsr/supabase__supabase-js',
      // Edge functions import via the Deno `jsr:` specifier; rewrite to the
      // npm package so Vitest can resolve it. The test files separately
      // `vi.mock(...)` the same specifier so no real network calls happen.
      'jsr:@supabase/supabase-js@2.49.8': '@supabase/supabase-js',
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Note: we deliberately do NOT exclude `src/supabase/functions/**`
    // here. Edge-function source files use Deno-only imports
    // (`npm:`/`jsr:`/`Deno.*`) that can't run in Node, but the only files
    // matched by the `include` glob are `*.test.ts` / `*.spec.ts` test
    // files, which mock those imports and run cleanly in Vitest.
    exclude: [
      'node_modules',
      'dist',
      'scripts/**',
      // P8.9 — Playwright specs run via `npm run test:e2e`, not Vitest.
      'e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/test/**',
        'src/assets/**',
        'src/guidelines/**',
        'src/supabase/functions/**',
      ],
      // Phase 1 floors. Phase 4 raises these to 70/65/70/70.
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 25,
        statements: 30,
      },
    },
  },
});
