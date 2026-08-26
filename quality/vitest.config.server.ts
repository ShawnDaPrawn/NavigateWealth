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
      //
      // Raised again 2026-08-26 (18.9 / 13.3 / 18.2 / 19.3) with the
      // estate-planning-fna-will-routes contract suite — 10 routes over a
      // client's Last Will and Living Will, where the record owner is
      // recovered by regex from a caller-supplied url segment. Measured
      // 19.65 / 13.76 / 18.66 / 20.16 across 1,409 tests.
      //
      // Raised again 2026-08-26 (19.5 / 13.7 / 18.5 / 20.0) with the reporting
      // dashboard task-metric suite — the dashboard had been reading a table
      // that does not exist and reporting a confident zero. Measured
      // 19.79 / 13.98 / 18.94 / 20.30 across 1,428 tests.
      //
      // Raised again 2026-08-26 (19.7 / 13.9 / 18.8 / 20.2) after Codex review
      // on #237 found two real holes in the RoA suite: the legacy
      // `super-admin` spelling was absent from every role array, and
      // cross-owner denial was asserted on 2 of 18 ownership-gated routes.
      // Measured 20.15 / 14.21 / 19.25 / 20.66 across 1,488 tests.
      //
      // Raised again 2026-08-26 (20.0 / 14.1 / 19.1 / 20.5) with two suites:
      // locked/refund-clusters-routes (25 routes behind one `app.use('*',
      // requireSuperAdmin)` line, over stored tax numbers, eFiling passwords
      // and bank credentials) and integrations-portal-jobs-routes (the robot
      // that logs into provider portals as the firm). Measured
      // 22.46 / 16.66 / 21.94 / 23.05 across 2,208 tests.
      //
      // The portal-jobs suite is the one to copy: it mocks ONLY the network
      // boundary and runs the guards, flow resolution, credential lookup and
      // sync engine for real against an in-memory KV. That single file moved
      // the number roughly twice as far as an equivalent one built on stubbed
      // collaborators, because the collaborators are where the logic lives.
      //
      // Raised again 2026-08-26 (22.3 / 16.5 / 21.8 / 22.9) with the auth-routes
      // suites — 10 routes handling signup, login, password reset and the admin
      // security dashboard, at 0% before. What they protect is the ABSENCE of
      // information (anti-enumeration: five different failures, one
      // indistinguishable response) plus rate limiting on two axes that fails
      // closed, so the tests assert uniformity and refusal rather than payload
      // shapes. Measured 23.32 / 17.35 / 22.66 / 23.92 across 2,354 tests.
      //
      // Raised again 2026-08-26 (23.2 / 17.2 / 22.5 / 23.8) with the
      // applications-routes suite, which found two real bugs rather than just
      // covering code: an admin-gated debug route that returned every value in
      // the shared KV store (portal credentials included), and a literal route
      // shadowed by a parameterised one. Measured 23.78 / 17.60 / 23.02 / 24.41
      // across 2,446 tests.
      //
      // Raised again 2026-08-26 (23.7 / 17.5 / 22.9 / 24.3) with the
      // auth-middleware-cost ratchet, which came out of noticing that 113 route
      // registrations chained `requireAuth, requireAdmin` — two full auth
      // resolutions (a Supabase Auth round trip plus a database read each) for
      // one answer. Measured 23.81 / 17.64 / 23.06 / 24.43 across 2,455 tests.
      //
      // Raised again 2026-08-26 (23.8 / 17.6 / 23.0 / 24.4) with two more
      // suites: communication-routes (24 routes that send email and WhatsApp to
      // the whole client base, split across two authorization tiers, where the
      // three client-facing routes take ownership from the session and never
      // from the request) and compliance-service (the firm's FAIS, AML, POPIA
      // and FSCA-debarment records — including tests that pin the AML and
      // debarment "checks" as the placeholders they still are). Measured
      // 24.55 / 17.93 / 24.12 / 25.21 across 2,801 tests.
      //
      // Raised again 2026-08-26 (24.5 / 17.9 / 24.0 / 25.1) with two suites that
      // both let the REAL renderer run rather than stubbing it, which is why
      // they moved the number so far for their size: esign-certificates went
      // 0.4% -> 92.5% by letting pdf-lib build the actual certificate, and
      // contact-pdf-generator went 0% -> 98.7% because it has no dependency but
      // the logger. Measured 25.92 / 18.51 / 24.81 / 26.64 across 2,895 tests.
      //
      // Raised again 2026-08-26 (25.8 / 18.4 / 24.7 / 26.5) with the
      // requests-service suite — the self-healing workflow layer behind
      // compliance requests, where the zod schema deliberately repairs instead
      // of rejecting, so the tests pin what the healing silently rewrites.
      // Writing it found the audit log overwriting itself. Measured
      // 26.37 / 18.87 / 25.44 / 27.10 across 2,976 tests.
      //
      // Raised again 2026-08-26 (26.3 / 18.8 / 25.3 / 27.0) with the
      // client-portal-service suite — the single read behind the client-facing
      // dashboard, which fans out across eleven KV namespaces. Writing it found
      // the calendar filter excluding only events that named a DIFFERENT
      // client, so an event with no clientId would have shown on every client's
      // portal. Measured 26.67 / 19.62 / 25.71 / 27.41 across 3,035 tests.
      //
      // Raised again 2026-08-26 (26.6 / 19.5 / 25.6 / 27.3) with the article
      // notification suites — recipient collection, delivery and retry
      // classification, the job lifecycle, the cron processor and the campaign
      // rows the publications dashboard reads. 163 tests across five files,
      // covering roughly 2,400 lines that had no test at all.
      //
      // The SAME change also fixed the denominator. Four server modules
      // (esign-pdf-analysis, esign-pdf-protect, esign-synthetic-probe,
      // form-template-routes) imported `npm:` specifiers with no alias in
      // vitest.config.ts, so Vite could not transform them; the v8 provider
      // then logged "Failed to parse … Excluding it from coverage" and dropped
      // them from the report altogether instead of counting them as 0%. That
      // hid 460 statements — including the e-signature signing path — and
      // inflated every number above it. The aliases are added, the parse
      // failures are gone, and the floors below are measured against the
      // complete tree, so they are lower than they would have been under the
      // old short denominator and still a ratchet up on it.
      //
      // Measured 28.52 / 21.75 / 28.13 / 29.24 across 3,198 tests.
      //
      // Raised again 2026-08-26 (28.3 / 21.6 / 27.9 / 29.0) with the
      // auto-content suites — the four pipelines that write published-facing
      // articles on a schedule with no human in the loop. 104 tests across
      // three files took auto-content-service.ts from 0% to 99.6% and
      // auto-content-pipelines.ts from 0% to most of its branches. The SSRF
      // guard on `discoverFeeds` is exercised for real rather than stubbed,
      // because that endpoint fetches an admin-supplied URL server-side.
      // Writing them found the run-log key colliding on millisecond precision,
      // the same defect as the compliance audit log. Measured
      // 30.19 / 22.93 / 29.54 / 30.93 across 3,302 tests.
      thresholds: {
        statements: 29.9,
        branches: 22.7,
        functions: 29.3,
        lines: 30.7,
      },
    },
  },
});
