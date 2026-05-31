import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

/**
 * Vitest configuration (Phase 1 / Phase 4 — Guidelines §15).
 *
 * - Uses jsdom for React component testing.
 * - Coverage uses v8; thresholds start moderate (Phase 1) and tighten in
 *   Phase 4 once the suite is fleshed out. CI fails the build if coverage
 *   drops below the configured floor (see .github/workflows/ci.yml).
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
      'npm:hono/cors': 'hono/cors',
      'npm:@e965/xlsx@0.20.3': 'xlsx',
      'jsr:@std/encoding/base64': '@jsr/std__encoding/base64',
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
    // v8 coverage instrumentation makes the suite run ~2-3x slower, which pushes
    // a few dialog/interaction tests past the 5s Vitest default and flakes the
    // CI gate (which runs `--coverage`). 15s gives realistic headroom under
    // instrumentation without masking a genuine hang (passing tests are
    // unaffected; only a real hang waits longer before failing).
    testTimeout: 15000,
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
      // Enforced regression floor (Phase 4). These are set just below the
      // CURRENT measured coverage — the previous 30/30/25 values were never
      // enforced because @vitest/coverage-v8 wasn't installed and no CI step
      // ran `--coverage`, so they were aspirational fiction. This floor is now
      // gated in CI (the Vitest step runs with `--coverage`), so coverage can
      // only go UP. Ratchet these toward the 70/65/70/70 target as
      // characterization tests are added for the Phase 5/6 decomposition files.
      //
      // Ratcheted as characterization tests land. Latest (after extracting +
      // testing ClientOverviewTab's pillars -> derivePillars): measured lines 6.46
      // / functions 4.55 / branches 5.81 / statements 6.41.
      // Floor kept just below measured (small CI safety margin).
      thresholds: {
        lines: 6.4,
        functions: 4.5,
        branches: 5.7,
        statements: 6.35,
      },
    },
  },
});
