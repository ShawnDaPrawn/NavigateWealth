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
      'sonner@2.0.3': 'sonner',
      'react-hook-form@7.55.0': 'react-hook-form',
      'pdf-lib@1.17.1': 'pdf-lib',
      'node-forge@1.3.1': 'node-forge',
      '@supabase/supabase-js@2.39.3': '@supabase/supabase-js',
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
