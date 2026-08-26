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
    alias: [
      // figma:asset/... imports are design-tool build-plugin URLs that Vite
      // resolves in production but cannot transform in the Node/Vitest environment.
      // Stub them out to an empty string so test files can import modules that
      // transitively depend on provider-logos.ts without a transform error.
      {
        find: /^figma:asset\/.+$/,
        replacement: path.resolve(__dirname, './src/test/__mocks__/figma-asset-stub.ts'),
      },
      // Deno edge-function specifiers, rewritten so Vitest (Node) can resolve
      // them; edge test files `vi.mock(...)` these so no real network calls run.
      { find: 'pdf-lib@1.17.1', replacement: 'pdf-lib' },
      { find: 'npm:pdf-lib@1.17.1', replacement: 'pdf-lib' },
      // Keep the unversioned form AFTER the pinned one: Vite matches string
      // aliases by prefix in array order, so 'npm:pdf-lib' listed first would
      // swallow 'npm:pdf-lib@1.17.1' and rewrite it to 'pdf-lib@1.17.1'.
      { find: 'npm:pdf-lib', replacement: 'pdf-lib' },
      { find: 'npm:docx', replacement: 'docx' },
      { find: 'npm:jspdf-autotable', replacement: 'jspdf-autotable' },
      { find: 'npm:jspdf', replacement: 'jspdf' },
      { find: 'npm:zod', replacement: 'zod' },
      { find: 'npm:hono', replacement: 'hono' },
      { find: 'npm:hono/cors', replacement: 'hono/cors' },
      { find: 'npm:@e965/xlsx@0.20.3', replacement: 'xlsx' },
      { find: 'npm:@zip.js/zip.js', replacement: '@zip.js/zip.js' },
      { find: 'jsr:@std/encoding/base64', replacement: '@jsr/std__encoding/base64' },
      { find: 'node-forge@1.3.1', replacement: 'node-forge' },
      { find: 'npm:node-forge@1.3.1', replacement: 'node-forge' },
      // The e-signature signing stack. Without these the four modules that use
      // them fail to transform, and Vitest's coverage provider then drops them
      // from the report entirely rather than counting them as uncovered — which
      // silently shrinks the denominator the backend ratchet floors against.
      { find: 'npm:@signpdf/signpdf', replacement: '@signpdf/signpdf' },
      { find: 'npm:@signpdf/signer-p12', replacement: '@signpdf/signer-p12' },
      {
        find: 'npm:@signpdf/placeholder-pdf-lib',
        replacement: '@signpdf/placeholder-pdf-lib',
      },
      {
        find: 'npm:pdfjs-dist@4.7.76/legacy/build/pdf.mjs',
        replacement: 'pdfjs-dist/legacy/build/pdf.mjs',
      },
      { find: '@jsr/supabase__supabase-js@2.49.8', replacement: '@jsr/supabase__supabase-js' },
      // Edge functions import via the Deno `jsr:` specifier; rewrite to the
      // npm package so Vitest can resolve it. The test files separately
      // `vi.mock(...)` the same specifier so no real network calls happen.
      { find: 'jsr:@supabase/supabase-js@2.49.8', replacement: '@supabase/supabase-js' },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
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
      // Ratcheted as characterization tests land. Latest (2026-06-02,
      // EsignModule render test — dashboard mount + template-picker → upload
      // wizard transition; also fixed RiskAssessmentPanel mock after Cursor
      // refactored it from raw fetch to api.get): measured statements 10.06 /
      // lines 10.08 / branches 8.71 / functions 8.12 across 1028 tests. Floor
      // raised from 9.5/9.5/8.25/7.7, kept ~0.35-0.4 below measured.
      //
      // 2026-06-02 (phase4 characterization batch): added render-contract tests
      // for PortalAutomationTab (1,709 lines), ReviewDialog (1,825 lines), and
      // ComplianceTab (1,723 lines) — all previously at 0% coverage. Conservative
      // floor bump of ~0.2 pending CI measurement of the actual delta.
      //
      // 2026-06-02 (phase4 S4/S5): added ClientOverviewTab adviser-mode test
      // (Risk pillar card + full five-pillar set) and PrepareFormStudio
      // interaction tests (Save disabled on mount, Send calls onSendForSignature).
      // Conservative floor bump +0.1.
      //
      // 2026-06-02 (phase4 S6/S8): added render-contract tests for
      // ComplianceResultViewer (1,494 lines), WillPdfView (1,396 lines), and
      // IssuesModule (1,285 lines) — all previously at 0% coverage.
      // S6/S8 render-contract tests cover the always-visible chrome of three
      // large components. Floor stays at the confirmed S4/S5 measured baseline
      // (10.0/8.05/8.65/10.0); re-ratchet after CI reports the measured delta.
      //
      // CAVEAT — silent denominator: ~16 mostly-static .tsx files (HomePage +
      // the marketing/product pages, Logo, HeroSection, provider-logos,
      // EmailSignatureGenerator) fail @vitest/coverage-v8 parsing and are
      // auto-excluded from coverage. The % is over the parseable files only;
      // fixing the parser quirk would add ~0%-covered files to the denominator
      // and could dip the %, so RE-MEASURE before trusting headroom.
      //
      // The 70/65/70/70 end-goal is long-horizon — floor only ratchets up.
      thresholds: {
        lines: 30.0,
        functions: 25.0,
        branches: 20.0,
        statements: 29.0,
      },
    },
  },
});
