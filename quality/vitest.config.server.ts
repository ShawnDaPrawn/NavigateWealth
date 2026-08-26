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
      //
      // Raised again 2026-08-26 (29.9 / 22.7 / 29.3 / 30.7) with the e-sign
      // storage and template suites. esign-storage.ts 2.2% -> 88.2% (the object
      // paths, upsert rules, MIME and size gating and filename sanitisation
      // under the ECTA evidence chain, with a known-answer SHA-256 test rather
      // than a self-consistent one); esign-template-service.ts 1.1% -> 43.3%
      // (the version-bump rule, field by field, because an envelope records the
      // template version it was raised under and a wrong bump strands it).
      // Measured 30.90 / 23.48 / 30.29 / 31.63 across 3,388 tests.
      //
      // Raised again 2026-08-26 (30.7 / 23.3 / 30.0 / 31.4) with the ai-advisor
      // route suites. ai-advisor.ts 0% -> 86.2%, and because the whole auth
      // chain runs for real against the in-memory KV rather than being stubbed,
      // ai-advisor-store 0 -> 45.9%, ai-advisor-shared 0 -> 100%, auth-mw
      // -> 77.8% and constants -> 100% came with it. The tests are mostly about
      // who may open a client's Ask Vasco conversation, and they surfaced that
      // the `viewer` personnel role can DELETE one — pinned and flagged, not
      // changed. Measured 31.80 / 24.06 / 31.24 / 32.52 across 3,470 tests.
      //
      // Raised again 2026-08-26 (31.6 / 23.9 / 31.0 / 32.3) with the newsletter,
      // will-chat and tax-agent suites: newsletter-service 0.6% -> 98.8%,
      // will-chat-service 0% -> 92.0%, tax-agent-service -> 78.7%. The
      // newsletter tests are mostly about POPIA — which operations may set
      // `active: true` on someone who opted out, and which must refuse. Writing
      // the will-chat tests found a colliding session id that silently destroyed
      // an interview transcript, and the same defect in tax-agent-service.
      // Measured 33.01 / 25.45 / 32.52 / 33.74 across 3,560 tests.
      //
      // Raised again 2026-08-26 (32.8 / 25.2 / 32.3 / 33.5) with the tasks and
      // personnel-permissions suites: tasks-routes 21.3% -> 86.3%,
      // client-management-personnel-routes 0% -> 46.0%, and because the two
      // permission services run for real rather than being stubbed,
      // personnel-permissions-service -> 77.5% and permission-audit-service
      // -> 69.4% came with them. Writing them found three routes turning a
      // malformed body into a 500, and an eighth timestamp-as-key collision —
      // in the permission audit trail itself. Measured
      // 33.96 / 26.11 / 33.35 / 34.70 across 3,653 tests.
      //
      // Raised again 2026-08-26 (33.7 / 25.9 / 33.1 / 34.5) with the
      // count-derived version fix and its harness: one shared FNA/INA route
      // harness, behavioural delete-then-create suites for medical, investment
      // and estate, and a source ratchet. Measured
      // 34.25 / 26.22 / 33.56 / 35.02 across 3,673 tests. The gain is modest
      // for the size of the change because most of it is source fixes across
      // ten modules rather than new test surface — floored anyway, because an
      // unclaimed gain is one the next PR can give back.
      //
      // Raised again 2026-08-26 (34.0 / 26.0 / 33.3 / 34.8) with three FNA
      // route-family suites on one shared harness — tax planning 0% -> ~90%,
      // risk planning 24% -> ~85%, retirement 19% -> ~80%. Writing them found
      // four defects: a bucket created before the access check, an update route
      // that merged the RAW request body into the record (so a client's
      // adviser could hand their risk analysis to another client), an unpublish
      // that left the published pointer serving the withdrawn FNA, and two
      // version helpers reading a prefix that held no FNAs at all. Measured
      // 35.75 / 26.95 / 34.66 / 36.56 across 3,830 tests.
      //
      // Raised again 2026-08-26 (35.5 / 26.7 / 34.4 / 36.3) with the e-sign
      // packet suite: esign-packet-service 0.6% -> 84.9%. It runs
      // `esign-services` and `esign-template-service` for real rather than
      // stubbing them — both are pure KV apart from a fire-and-forget Postgres
      // mirror — because the thing under test is a handoff BETWEEN modules, and
      // a suite that fakes `createEnvelope` would assert that a mock was called
      // rather than that a packet run spawns a signable envelope. Measured
      // 36.29 / 27.34 / 35.25 / 37.07 across 3,852 tests.
      //
      // Raised again 2026-08-26 (36.1 / 27.1 / 35.0 / 36.9) with the e-sign
      // documents-routes suite: the page-manifest and multi-document routes on
      // an envelope. Measured 36.73 / 27.69 / 35.66 / 37.50 across 3,893 tests.
      //
      // Raised again 2026-08-26 (36.6 / 27.5 / 35.4 / 37.3) with the e-sign
      // envelopes and campaigns route suites. Both run their services for real
      // — `esign-services`, `esign-campaign-service`, `esign-packet-service`
      // and `esign-template-service` are all pure KV — so the CSV parsing, row
      // mapping and campaign state machine under those routes are exercised
      // rather than mocked. Measured 37.69 / 28.40 / 36.73 / 38.40 across
      // 3,962 tests.
      //
      // Raised again 2026-08-26 (37.5 / 28.2 / 36.5 / 38.2) with the e-sign
      // templates suite and the documents-routes firm-scope fix. Measured
      // 37.95 / 28.58 / 36.89 / 38.65 across 4,006 tests.
      //
      // Raised again 2026-08-26 (37.8 / 28.4 / 36.7 / 38.5) with the RoA draft
      // service (4.1% -> 47.7%) and vasco-service (0% -> ~80%). The
      // denominator also fell slightly: `vasco-service` carried a second,
      // never-imported rate limiter, removed rather than covered. Measured
      // 38.61 / 29.30 / 37.66 / 39.32 across 4,052 tests.
      thresholds: {
        statements: 38.4,
        branches: 29.1,
        functions: 37.4,
        lines: 39.1,
      },
    },
  },
});
