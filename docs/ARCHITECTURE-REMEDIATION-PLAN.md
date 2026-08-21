# Navigate Wealth — Architecture Evaluation & Remediation Plan

> **Purpose.** A single, evidence-based assessment of the codebase as it
> stands on `main` (commit `6303993`, verified 2026-08-21) and a sequenced
> plan to take it from "ships and works" to genuinely first-class,
> better-than-production-grade. Written to be worked from top-down.
>
> This document complements `docs/PRODUCTION-READINESS.md` (the status
> ledger). Where the two disagree, the corrections in
> [§8 Ledger corrections](#8-ledger-corrections) are authoritative — they
> are based on direct re-verification, not memory.
>
> For the **target-state architecture and codebase-organisation blueprint** —
> what "good" looks like once these fixes land, with the conventions and
> fitness functions that keep it that way — see
> `docs/ARCHITECTURE-ENHANCEMENT-PLAN.md`. This plan is the sequenced _fix
> list_; that one is the _destination_.

---

## 1. Verdict

**The engineering discipline here is well above average for a codebase this
size, but it is sitting on top of three or four live, severe security
exposures and a data layer that will not scale — and the automated gate that
was meant to protect the architecture has never actually run.**

Two things are true at once and both matter:

- **The craft is real.** Strict TypeScript at 0 errors across three runtimes,
  0 `@ts-ignore` in ~449K lines of frontend, a properly-designed API client
  with a refresh mutex, thorough route-level code-splitting, an honest coverage
  config, a genuinely clever CI ratchet that turns "someone mounted a router
  without auth" into a build failure, and unusually candid in-code documentation
  of its own debt. This is not a beginner codebase.

- **The gaps are the kind that end companies, not sprints.** The public
  Supabase anon key is accepted as a full admin credential on every financial,
  medical, and estate route. An entire `/documents` API is unauthenticated and
  lets anyone who knows a user's UUID read, upload, and **delete** that client's
  files. The PDF-signing private key sits in plaintext in a table any admin can
  read. For a South African financial-advisory platform holding FNA data,
  medical information, wills, and e-signatures, these are POPIA
  reportable-breach-class exposures — and they are documented in-repo as
  _known, deferred_ debt that has been open for roughly two months.

**So: is it "production grade"?** Operationally it runs. By the standard you
asked for — better than production grade — **not yet**, and the blocking
category is security/data-integrity, not tooling. The good news is that the
team has already _found_ almost all of these (the CI ratchet, the
`SECURITY-AUDIT-2026-06.md` doc, and the inline `SECURITY-AUDIT C-7` comments
prove it). The gap is remediation capacity and sequencing, not detection. That
is exactly what this plan supplies.

**The single highest-leverage fact in this whole document:** the two worst
security holes (anon-key-as-admin and the `/documents` IDOR) share **one root
cause** — the frontend API client sends the public anon key as a bearer token
whenever there is no live session (`src/utils/api/client.ts:100,115,122`), and
the backend accepts that exact key as admin (`fna-auth.ts:86`). You cannot
simply gate those routes today without 401-ing live client traffic. **The
frontend auth-token migration is the keystone.** Both criticals fall out of it,
and it is the first real work in this plan.

---

## 2. How this was assessed

- **Local quality gates re-run from a clean `node_modules`** (all green,
  confirming the ledger's baseline): `lint` 0 errors / 59 warnings (since
  reduced to 55 and ratcheted — see correction 3 below),
  `typecheck` 0 errors, `typecheck:middleware` 0 errors, `depcruise` "no
  violations", `build` passes with SEO verification, and `vitest --coverage`
  passes with **measured coverage: statements 31.31%, branches 23.0%,
  functions 26.62%, lines 32.05%**.
- **Four independent deep audits** — frontend architecture, backend/server
  architecture, security posture, and testing/quality — each reading source
  with file/line evidence.
- **The four most severe or surprising claims were personally re-verified**
  against source before being written here: the anon-key-as-admin branch
  (`fna-auth.ts:77-89`), the unauthenticated `/documents` routes
  (`documents.tsx:116+`), the API-client anon-key fallback
  (`client.ts:88-123`), and the vacuous dependency-cruiser gate (dumped the
  cruise JSON: 49/52 deps `couldNotResolve`).

### Scale, corrected

The working figure of "~238K lines" is roughly half the truth. Actual `src/`:
**585K lines across 2,244 files.** Of that, the Deno edge function is ~136K
lines (432 files) and the SPA is ~449K lines. `src/components/admin` alone is
**317K lines — 74% of all component code.** This matters because the enforced
~31% coverage is measured only over the _parseable SPA subset_ and **excludes
the entire 136K-line backend**, so effective whole-repo coverage is closer to
~22%.

---

## 3. What is genuinely strong — do not regress this

A remediation plan that damages the good parts is a failure. Preserve:

1. **Type safety.** `strict: true` + `noUnusedLocals/Parameters/FallthroughCases`,
   SPA typecheck burned down from ~1,308 errors to **0** and gated, **0
   `@ts-ignore`** repo-wide, **5** `@ts-expect-error` each with a reason, and
   **0 `any` in `src/shared` and `src/utils`** (the core logic). This is the
   standout.
2. **The router-auth-guard CI ratchet**
   (`server/__tests__/router-auth-guard.test.ts`). It walks every mounted
   router's import tree for an auth marker and fails the build for any
   unguarded router not on an _annotated_ debt allowlist. Keep it; §5 explains
   its one blind spot (route-granularity).
3. **The API client** (`src/utils/api/client.ts`) — refresh mutex, proactive
   refresh, scoped retry, typed `APIError`, session-recovery events. This is
   the pattern the stragglers (§Phase 3) should converge onto, not something to
   replace.
4. **Lazy-router with thundering-herd dedup** (`server/lazy-router.ts`) — light
   boot, correct concurrent-import handling.
5. **Route-level code splitting** — 72 `React.lazy` pages, mature chunk-load
   failure recovery (`App.tsx:17-49`), 20 named vendor chunks.
6. **`resolveTrustedRole`** (`server/constants.ts:124`) — refuses privileged
   roles from client-writable `user_metadata`. The classic escalation is
   correctly closed.
7. **Honest self-documentation** — the coverage caveat in `vitest.config.ts`,
   the `KNOWN_UNAUTH_DEBT` map, and the CORS fail-open rationale are exactly
   what made this audit fast. Keep writing debt down where it lives.
8. **Data access is funnelled through the Edge Function** — the SPA never
   queries Postgres tables directly (0 `.from(` calls outside `src/supabase`),
   so RLS is a second line of defence rather than the only one.

---

## 4. Findings by severity

Severity is about blast radius, not effort. IDs are used in the plan.

### CRITICAL — security & data integrity (fix before building new features)

- **S1 — Public anon key = admin on all FNA/tax/estate/medical/prefill routes.**
  `fna-auth.ts:86` returns `ADMIN_USER` for anyone presenting the anon key,
  which ships in the browser bundle (`utils/supabase/info.tsx:5`). Unauthenticated
  internet access to full client financial + medical PII. Self-documented as
  `SECURITY-AUDIT §8 C-7`.
- **S2 — `/documents/*` is entirely unauthenticated (IDOR).**
  `documents.tsx` imports no auth helper; `GET/POST/PATCH/DELETE /:userId[...]`
  let anyone with a user UUID list, upload, download (1-hour signed URLs), and
  delete another client's documents. Tracked in `KNOWN_UNAUTH_DEBT`. Live now.
- **S3 — `verify_jwt = false` + auth enforced only by convention.**
  `supabase/config.toml` disables gateway JWT verification; the comment claims
  every sub-router self-gates, but only **18 of 113 route files** apply
  router-scoped auth. S1 and S2 are symptoms of this posture. There are **6
  parallel auth mechanisms** in use.
- **S4 — Signing private key + passphrase in plaintext KV**, readable by any
  `admin` via the unbounded `GET /kv-store/:key` reader (`kv-routes.ts:24`,
  `esign-pdf-protect.ts:47`). An admin (not just super-admin) can exfiltrate the
  document-signing key and forge signatures that validate identically to
  genuine ones.
- **S5 — KV data layer: 119 unbounded whole-namespace scans, silent truncation.**
  `getByPrefix` has no limit (`kv_store.tsx:90`); PostgREST caps at ~1000 rows
  and nothing handles truncation. One dashboard call
  (`reporting-service.ts:53`) loads every profile + application + FNA +
  communication into one isolate. This is both a hard scaling ceiling and a
  silent-correctness bug: counts and lists will quietly go wrong as data grows.

### HIGH

- **S6 — Auth-without-authz on e-sign downloads.** 8 handlers discard the auth
  context (`const _ctx = …`); any authenticated user — including a
  self-registered client — can download any completed signed PDF or audit
  export by envelope ID (`esign-sender-download-routes.ts:29,187,323`, etc.).
- **S7 — FNA routes authenticate but never authorize.** Any authenticated
  principal can read or `hard-delete` any client's FNA by ID
  (`retirement-fna-routes.tsx:214`, `risk-planning-fna-routes.tsx:891`, …).
- **S8 — Signer access token in the URL query string.**
  `/sign?token=<uuid>` → leaked to Google Analytics and Vercel Analytics
  (`App.tsx:134-148,209`, no `beforeSend` scrubber), plus browser history and
  `Referer`. The server already supports the token as a path segment.
- **S9 — No server-side HTML sanitization anywhere.** Correctness depends on
  every one of ~37 render sites getting DOMPurify right; non-React consumers
  (outbound email, PDF) get raw HTML. Confirmed-unsanitized sinks:
  `AIWritingPanel.tsx:712` (raw LLM output), `MarkdownPreview.tsx:210`
  (working `javascript:` URI).
- **S10 — Public lead-gen forms inject unescaped input into staff email.**
  `quote-request-routes.ts`, `contact-form-routes.ts`, `consultation.ts` build
  admin-notification HTML by string interpolation of anonymous input with **0
  `escapeHtml` calls** — though the helper exists and is used elsewhere.
- **S11 — Rate limiters are non-atomic, IP-blind on public forms, and fail
  open.** All six limiters do read-modify-write on KV (races under burst);
  public forms key on email only (rotate the address → unlimited);
  `rateLimiter.ts:146` returns `allowed:true` when KV degrades — disabling
  login brute-force protection exactly when it's needed. ~560 routes have no
  limiting, including the paid AI endpoints.
- **D1 — RLS on `kv_store_91ed8379`: VERIFIED SAFE (2026-08-21).** _Closed — was
  the audit's top-3 "may be total exposure", and it is not._ Checked directly
  against the production project (`vpjmdsltwrnpefzcgdmz`), read-only:
  `kv_store_91ed8379` has **RLS enabled with 0 policies**, which is deny-all for
  `anon` and `authenticated` — only `service_role` (which bypasses RLS) reaches
  it, exactly as intended. Supabase's own linter classifies this as INFO, not a
  vulnerability. All 7 `public` tables have RLS enabled, and `storage.objects`
  is likewise RLS-on with no policies (service-role only). The suspected
  `public.exec_sql` arbitrary-SQL vector (§9) **does not exist** in production —
  also closed.

  Residual, low severity, NOT exposures — recommended hardening, not applied
  here because they are production changes with live-traffic implications:
  1. `get_events_today`, `get_reminders_due_today`, `get_upcoming_reminders` are
     `SECURITY DEFINER` and carry `EXECUTE` for `anon`. The linter flags the
     pattern, but **all three self-scope on `auth.uid()`**, which is NULL for
     anon, so they return zero rows and leak nothing — verified by calling them
     as the `anon` role. Revoke `anon` EXECUTE anyway (defence in depth); check
     first that no client calls these RPCs unauthenticated.
  2. Leaked-password protection (HaveIBeenPwned) is disabled in Auth. One
     dashboard toggle.
  3. Nine functions have a mutable `search_path`. Standard hardening.

- **D2 — Migration drift between the repo and production (NEW, 2026-08-21).**
  The repo's `supabase/migrations/` and the applied migrations have diverged, in
  both directions:
  - Applied in production: `create_kv_table_91ed8379`, `fna_intake_sessions`,
    `atomic_auth_rate_limit`.
  - **`20260420000001_esign_core_tables.sql` was never applied** — there are **no
    `esign_*` tables in any schema**. This corrects §5 of this plan and the
    ledger, both of which described those tables as landed with RLS: e-signature
    data lives entirely in KV.
  - ~~**`atomic_auth_rate_limit` has no migration file in the repo.**~~
    **CLOSED 2026-08-21** by main's PR #207, which added
    `supabase/migrations/20260821000001_atomic_auth_rate_limit.sql`. It creates
    `check_auth_rate_limit_91ed8379` (SECURITY DEFINER, correctly NOT executable
    by `anon`/`authenticated`), addressing the non-atomic half of S11. The
    drift in this direction is resolved; the two items below are not.
  - The `kv_store_91ed8379` table itself has no migration file either.

  Schema state that only exists in the dashboard cannot be reviewed, rolled
  back, or reproduced in a staging project. Reconcile: generate migration files
  for what is actually applied, and either apply or delete the esign migration
  so the folder tells the truth.

- **A1 — The dependency-cruiser boundary gate was vacuous.** _(FIXED 2026-08-21,
  Stage A.)_ Originally verified: 49/52 first-party imports resolved as
  `couldNotResolve:['unknown']` because the resolver had no `extensions` list,
  so all three "blocking" boundary rules had **never fired** — the CI green was
  vacuous, not clean. Fixed by adding `enhancedResolveOptions.extensions`; the
  first honest run surfaced **210 real violations** (109 cross-feature-internals,
  100 outsider-admin-internals, 1 spa-edge type-only false positive) — well
  above the ~83 estimable by hand. The three rules are now `warn` (visible,
  non-blocking) **and ratcheted against `.depcruise-baseline`** — CI fails if
  the count rises above the committed floor, so the backlog is strictly
  non-worsening while it is burned down under touch-it-you-fix-it. At 0, flip
  the rules to `error` for a hard zero.
- **A2 — Global error handler is never registered.** `error.middleware.ts` has
  a full Zod-aware handler with telemetry, reachable only via opt-in
  `asyncHandler`. `index.tsx` registers no `app.onError`/`app.notFound`, and
  mount failures are caught and **swallowed** (a broken deploy still reports
  `/health` = 200). Unanticipated throws return a bare 500 with no body, no
  request ID, and **no telemetry** — the observability pipeline misses exactly
  the errors it was built for.
- **A3 — Request IDs are generated but never reach the logs.**
  `c.get('requestId')` is read in 6 places against 235 logger instances; logs
  are emoji strings, not JSON, all forced to stderr (severity flattened). You
  cannot trace a request through the logs of a 584-route function. No metrics
  of any kind.
- **A4 — 7 quote wizards are byte-identical copy-paste, ~8,400 lines.**
  `loadDraft/saveDraft/clearDraft/formatCurrency/parseCurrencyToNumber/StepIndicator`
  duplicated verbatim ×7, all raw-`fetch()` past the API client. ~2,500–3,000
  extractable lines, and this is the untested public revenue path.
- **A5 — Validation covers <30% of mutating routes.** 82 schema-parse sites for
  283 POST/PUT/PATCH routes; 44 route files have zero; `zValidator` used 0
  times. Unvalidated set includes `auth-routes.ts` (signup/login/reset) and the
  entire e-sign family, writing straight into schemaless JSONB.
- **A6 — Single 136K-line Edge Function.** Every heavy lib (`pdf-lib`,
  `node-forge`, `@signpdf/*`, `jspdf`, `xlsx`, `zip.js`) is a static import;
  first hit on `/esign` after an isolate recycle parses ~19K lines + the crypto
  stack — and that path is a client clicking a signature link from email.
  Deploys are all-or-nothing across every domain with no canary or per-domain
  rollback.
- **A7 — 853 MB of raw Figma PNGs in `src/assets`; 812 MB in the build graph.**
  The webp-preferring resolver never fires (0 `.webp` in `src/assets`);
  `optimize:images` is not in `npm run build`. Individual 28–32 MB PNGs are
  emitted to `dist/`. All 154 are tracked in git (`.git` is 892 MB).
  _Now measured and gated (Stage A / F6): `imageBytes` is **864 MB** of an
  882 MB `dist/`, ratcheted in `.bundle-size-baseline.json` so it cannot grow._
  The fix the resolver was written for is to generate `<hash>.webp` into
  `src/assets` — `vite.config.ts:19-24` already prefers it. Weigh that against
  adding more binaries to an already-892 MB `.git`; generating at build time
  avoids the git cost.
- **A16 — The eager entry graph preloaded 735 KB of vendor chunks — FIXED
  2026-08-21.** _(Found by F6; the original diagnosis here was WRONG and is
  corrected below.)_

  **Symptom (as first reported, and correct):** `dist/index.html` carried
  `<link rel="modulepreload">` for `vendor-jspdf` (382 KB) and `vendor-tiptap`
  (353 KB), so every marketing-page visitor fetched a PDF generator and a
  rich-text editor before first paint.

  **Original diagnosis — wrong.** This was written up as "feature code eagerly
  imports admin tooling". It does not. Tracing static imports from `main.tsx`
  finds only **93 reachable files and no import of jspdf or tiptap at all**: the
  application's route-level code-splitting is correct.

  **Actual cause.** Vite's `__vitePreload` helper was hoisted by `manualChunks`
  into the `vendor-jspdf` chunk, and the entry chunk then statically imported
  that chunk to get it — `import{a as _}from"./vendor-jspdf-*.js"`, where `a` is
  `function(t,e,i){let s=Promise.resolve();…}`. So ~382 KB was preloaded for the
  sake of a ~300-byte helper, with `vendor-tiptap` pulled in the same way. A
  `manualChunks` pitfall, not an application-architecture problem.

  **Fix.** `jspdf`/`jspdf-autotable` and `@tiptap/*` are used only from lazy
  routes, so they no longer get forced into named manual chunks — Rollup emits
  them as ordinary async chunks (`jspdf.es.min-*.js` etc.), which is what they
  always should have been. Verified: both libraries are still present and
  reachable, and `totalJsBytes` fell 0.1%, so nothing was duplicated across
  chunks.

  **Measured result — the largest user-facing win in this plan so far:**

  | Metric                     | Before   | After        | Change     |
  | -------------------------- | -------- | ------------ | ---------- |
  | Eager entry (uncompressed) | 2.33 MB  | **1.86 MB**  | **−20.1%** |
  | Eager entry (gzipped)      | 655.5 KB | **496.6 KB** | **−24.2%** |

  ~159 KB less gzipped on every single page load. Re-baselined into F6 so it
  cannot regress.

  **Lesson worth keeping:** `manualChunks` decides where shared helpers land. A
  named vendor chunk that is only needed lazily can still be dragged into the
  eager graph by a few bytes of hoisted runtime. Check `dist/index.html`'s
  modulepreload list after changing chunking — F6 now does this automatically.

- **A8 — Backend is 8.6% test-file-covered and 0% coverage-measured, and
  deploys with only a non-blocking, credential-gated smoke test.** Combined with
  A2, ~136K lines ship to production essentially unverified.
  _Measurement half FIXED (Stage A / F4, 2026-08-21):_ the backend is now
  measured and floored separately via `vitest.config.server.ts` —
  **statements 13.43%, branches 9.38%, functions 12.88%, lines 13.79%** across
  573 tests, gated as its own CI step. So the number is real and can only
  ratchet up. **Still open:** the blocking post-deploy smoke test in
  `deploy-supabase-function.yml` — measurement is not verification, and the
  backend still deploys without one.
- **A9 — Playwright e2e never runs in CI.** All 9 specs `test.skip` on missing
  credentials; no workflow runs them; the `retries: CI?2:0` branch is dead.
  Effective e2e coverage is zero.
- **A10 — Deprecated `SUPER_ADMIN_EMAIL` locks out the recovery admin.** 12
  production call sites in 5 files; `client-management-super-admin-routes.ts:182`
  denies the recovery super-admin from the very route built for recovery.
- **A11 — CI theatre.** _(audit half FIXED 2026-08-21, Stage A / F7.)_
  `npm audit` was fully advisory (`|| true`, no severity gate) on a
  PII/signature platform — and the drift proved the point: 7 high + 2 moderate
  had accumulated unnoticed, including a runtime `react-router`
  XSS/open-redirect. `npm audit fix` cleared 6 highs + both moderates with no
  `package.json` change; high+critical is now ratcheted against
  `.npm-audit-baseline` (floor 1: dev-only `sharp`). **Still open:** two fake CI
  test steps write `.exit` files nothing reads, and the "publish quality
  snapshot" step can fail every PR on a Supabase outage (no
  `continue-on-error`).

### MINOR (batch opportunistically)

- **A12 — `react-toastify` toasts are a silent no-op** — **FIXED 2026-08-21
  (Stage A / F10).** No `<ToastContainer>` was mounted anywhere and its CSS was
  never imported, so admins saving e-sign reminder settings got no success or
  failure feedback at all (`ReminderSettingsPanel.tsx:67`). Swapped to `sonner`
  (identical API; every sibling in the module already used it), the dependency
  was removed, and it is now banned at `error` via `no-restricted-imports` so it
  cannot return. Dropping it from the eager `vendor-feedback` chunk also took
  the entry graph from 659.3 to **655.5 KB gzipped** (re-baselined into F6).
- **A13 — 1,056 lines of Quill CSS in the eager global stylesheet**
  (`src/index.css`), loaded on the marketing homepage for a 5-file admin editor.
- **A14 — Two large module `api.ts` files bypass the API client**
  (`publications/api.ts` 76 raw fetches, `social-media/api.ts` 27) — no retry,
  no 401-refresh, no `APIError`.
- **A15 — Dead weight**: `src/public/` duplicates `public/`;
  `components/figma/ImageWithFallback.tsx` has 0 importers; `react-dnd` (2 files)
  duplicates `@hello-pangea/dnd` (12); `useClientSearch.test.ts` leaks fake
  timers (one-line fix); 60 files > 1,000 lines.

---

## 5. The plan

Five phases, sequenced by dependency and risk. **Phases P0 and P1 are not
optional and should precede new feature work** — they are the difference
between "a breach we self-reported and fixed" and "a breach a regulator finds."
P2–P4 are the "better than production grade" build-out and can proceed in
parallel tracks once P0/P1 land.

Each workstream lists the finding IDs it closes and a concrete **acceptance
gate**. Every change follows the existing finalization protocol in `AGENTS.md`
(verify all gates locally → commit → PR → auto-merge), one reviewable slice at
a time.

### P0 — Contain the live exposures (days, not weeks)

Ordered. **D1 first because it may already be a breach and is a dashboard
check, not a code change.**

1. **D1 — Confirm RLS on `kv_store_91ed8379` and every KV/ad-hoc table.**
   In the Supabase dashboard, verify `ENABLE ROW LEVEL SECURITY` and a
   deny-by-default policy on `kv_store_91ed8379`, `personal_client_applications`,
   `tasks_91ed8379`, and any other table without a migration. Write the result
   into a new migration so the state is version-controlled.
   _Gate:_ a committed migration asserts RLS-on + service-role-only policy for
   every table; a PostgREST probe with the anon key returns 0 rows / 401.
2. **S4 — Move the signing key out of KV and lock the KV reader.**
   Make `NW_ESIGN_PLATFORM_P12_BASE64` the only source; delete the KV fallback
   and the `esign_config:platform_signing_cert` row. Gate `GET /kv-store/:key`
   behind `requireSuperAdmin`, add an `esign_config:*` denylist, and audit-log
   every read.
   _Gate:_ key is unreadable via any KV route; a test asserts the denylist.
3. **S8 — Get the signer token out of analytics, history, and referrers.**
   Redaction is **mandatory**, not optional: add a `beforeSend` scrubber to
   Vercel Analytics and a GA `page_location` redaction that strips `token` and
   client UUIDs, and clear the token from the address bar after read via
   `history.replaceState`. Note the token lives in the SPA route `/sign?token=`
   (`AppRoutes.tsx:907`, rendered by `SignerLandingPage`), **not** at the
   server JSON endpoint `GET /sign-by-token/:token` — so if the URL form is
   changed to a path segment (`/sign/:token`) that is a **frontend route
   migration** (a path token still enters history/referrers, so it does not
   replace scrubbing). Do not point signer links at the server API route; it
   does not render the signing page.
   _Gate:_ no analytics/referrer payload contains `token=`; the address bar no
   longer shows the token after load; a unit test covers the scrubber.
4. **S10 + S11 (public forms) — Escape output and add IP-dimensioned limits.**
   Apply the existing `escapeHtml` to every interpolated field in the three
   lead-gen email builders; add an IP dimension to their rate limiters (mirror
   the login limiter which already does IP+email).
   _Gate:_ a test injects `<script>` in a form field and asserts it is escaped
   in the rendered email; limiter test covers IP keying.
5. **S9 (worst two sinks) — Sanitize `AIWritingPanel` and `MarkdownPreview`.**
   Add DOMPurify at those two render sites and filter the `javascript:` URI in
   the markdown link rule.
   _Gate:_ tests assert `javascript:` and `<img onerror>` are neutralized.

### P1 — The auth keystone (the unlock for S1/S2/S3/S6/S7)

This is the largest single piece of work and it gates the most. Do it as its
own tracked epic, in slices, behind the router-auth-guard ratchet.

1. **P1.1 — Frontend auth-token migration.** Stop sending the public anon key
   as a bearer token when unauthenticated (`client.ts:100,115,122`). Introduce
   an explicit notion of _public_ endpoints (quote/contact/consultation) that
   need no bearer, versus _authenticated_ endpoints that must have a real JWT or
   fail. Migrate the known offenders that rely on the anon key
   (`communication/api.ts`, `WillDraftingFlow.tsx`, the 7 quote wizards, the 41
   `pages/*.tsx` raw fetchers).
   _Gate:_ no SPA code path sends `publicAnonKey` as `Authorization` for an
   authenticated route; the app still boots and public forms still work.
2. **P1.2 — Remove the anon-key-as-admin branch (S1).** Delete `fna-auth.ts:85-89`
   once P1.1 lands. Collapse the 6 auth mechanisms toward one
   (`auth-mw.ts`), and make `fna-auth`'s `authenticateUser` delegate to it.
   _Gate:_ a contract test asserts the anon key returns 401 on every FNA/tax/
   estate/medical route.
3. **P1.3 — Flip the gateway to `verify_jwt = true` (S3).** Supabase's
   `verify_jwt` is **per-function**, so flipping it on `make-server-91ed8379`
   makes the gateway reject _every_ request without a valid JWT — before Hono
   runs. That means it is not enough to split out health: **all genuinely public
   routes must move to an unauthenticated sibling function first.** Relocate the
   health routes _and_ the entire `PUBLIC_ROUTERS` set — quote-request,
   contact-form, consultation (lead-gen), `sign-by-token`, the RSS proxy, and
   the openclaw webhook — into an `public`/`unauthenticated` function (this is
   the `public` bounded-context function from the enhancement plan §3.3). Only
   then enable JWT verification on the authenticated function. This closes S2
   (`/documents`) structurally and makes "auth by convention" a defence-in-depth
   layer rather than the only gate.
   _Gate:_ `documents.tsx` routes return 401 unauthenticated; the public
   lead-gen forms, signer-token access, and health all still return their
   normal responses from the unauthenticated function; live smoke passes on
   both functions.
4. **P1.4 — Object-level authorization (S2/S6/S7).** Add per-resource ownership/
   firm checks to `documents.tsx`, the 8 e-sign download/audit handlers, and the
   FNA read/delete routes — modelled on the reference implementation already in
   `client-portal-routes.ts:48-57` (`isAdmin || userId === callerId`). Wire the
   existing `admin-audit-service` into export/delete paths.
   _Gate:_ contract tests assert a client A token is 403'd on client B's
   documents/FNA/envelopes; audit rows are written for exports and deletes.
5. **P1.5 — Enforce account suspension (found dead in the backend audit).**
   Wire `performSecurityCheck`/`checkAccountSuspension` into the request path
   (they currently have zero call sites).
   _Gate:_ a suspended user's existing JWT is rejected; test covers it.

### P2 — Make the architecture's guardrails real

1. **A1 — Fix the dependency-cruiser resolver, then triage.** Add
   `enhancedResolveOptions`/`extensions` + `tsConfig` resolution so first-party
   TS files resolve, confirm the three boundary rules now fire, then work the
   ~83 violations down (start with the client-facing `HomeDashboardPage` →
   1,600-line admin `ClientOverviewTab` leak). Keep the rules `warn` until the
   backlog is burned, then flip to `error`.
   _Gate:_ cruise JSON shows first-party deps resolving; a deliberate
   cross-module-internals import fails the gate in a test fixture.
2. **A2 + A3 — Register the global error handler and thread request IDs.**
   Add `app.onError(errorHandler)` + `app.notFound(...)` in `index.tsx`; stop
   swallowing mount failures (fail the boot or expose degraded health); make the
   logger carry `requestId` from context; emit JSON logs. Add minimal counters
   (request count, error count, p50/p95 by route family).
   _Gate:_ a thrown error returns the standard envelope with a request ID that
   appears in the log line; `/health` reflects a failed mount.
3. **A5 — Validation at the boundary.** Adopt `zValidator` (or a thin
   equivalent) so schemas are type-linked to handlers; start with
   `auth-routes.ts` and the e-sign family. Ratchet a "mutating routes with a
   schema" metric upward like the Deno baseline.
   _Gate:_ auth + e-sign mutating routes reject malformed bodies with 400 and a
   typed error; ratchet metric enforced in CI.
4. **A6 — Begin decomposing the monolith at its natural seams.** Extract the
   e-sign subtree (heaviest cold path, most compliance-sensitive) into its own
   function once P1.3's health split exists; convert the heavy PDF/crypto
   libraries to dynamic `import()` at the routes that use them. No behavior
   change; measure cold-start before/after.
   _Gate:_ `/esign` cold-start import weight drops materially; deploys of
   non-esign code no longer touch the esign function.

### P3 — Data layer & correctness (the scaling ceiling)

1. **S5 — Replace whole-namespace scans with bounded, paginated access.**
   Migrate the hot read paths (`reporting-service` dashboard, `tasks-routes`,
   `publications-admin-routes`) off `getByPrefix` onto `listByPrefix` with
   limits, and add explicit truncation handling. Introduce a thin
   `repositories/` layer so 128 files stop importing `kv_store` directly.
   _Gate:_ no unbounded `getByPrefix` on a request path; a KV-scale test asserts
   correct counts past 1,000 rows.
2. **D-model — Promote the highest-value entities out of JSONB.** Give
   `clients`, `applications`, and `tasks` real Postgres tables with indexes and
   RLS (as e-sign and FNA-intake already have), dual-write then cut over exactly
   like the FNA-intake launch track did. This is the long pole; scope it as its
   own epic after P0–P2.
   _Gate:_ per-entity migration + RLS + backfill script + read-from flag, mirror
   of the FNA-intake cutover.
3. **A10 — Remove `SUPER_ADMIN_EMAIL`.** Replace the 12 call sites with
   `isSuperAdminEmail()`; delete the const.
   _Gate:_ recovery admin can use the recovery routes; grep shows 0 references.

### P4 — Quality, testing & release confidence

1. **A8 — Measure and gate the backend.** Remove the blanket
   `src/supabase/functions/**` coverage exclusion, set an honest separate floor,
   and report SPA and backend as two numbers. Add a **blocking** post-deploy
   health/auth smoke to `deploy-supabase-function.yml` (hit root + 2–3 gated
   routes, assert 200/401) with a rollback path.
   _Gate:_ backend coverage is measured and floored; a red smoke fails the
   deploy.
2. **A9 — One real e2e journey in CI.** Seed data programmatically (not
   manually-copied single-use tokens), run the e-sign round trip against a
   preview deploy on PRs.
   _Gate:_ Playwright runs unattended in CI and is required.
3. **A4 — De-duplicate the quote wizards and put the public path under test.**
   Extract `useWizardDraft`, a shared `<StepIndicator>`, and a shared submit
   onto the API client; add a contract test for `quote-request-routes.ts` and
   one submit-path test per wizard.
   _Gate:_ ~2,500 lines removed; public quote path has route + submit tests.
4. **A11 — Fix the CI theater.** Gate `npm audit` on high/critical (with an
   allowlist ratchet like `.deno-check-baseline`); delete the two fake test
   steps; add `continue-on-error: true` to the quality-snapshot publish.
   _Gate:_ a seeded high CVE fails a PR; a Supabase outage does not.
5. **A12–A15 — Batch the minor cleanups.** Mount a `<ToastContainer>` or move
   `ReminderSettingsPanel` to `sonner` and delete `react-toastify`; scope the
   Quill CSS import into the editor; converge `publications`/`social-media`
   `api.ts` onto the API client; delete `src/public/`, the dead figma component,
   and one DnD library; add `afterEach(vi.useRealTimers())` to test setup.
   _Gate:_ toasts render; homepage no longer ships Quill CSS; one DnD lib
   remains.

---

## 6. Sequencing at a glance

```
P0  Contain exposures        ── D1 → S4 → S8 → S10/S11 → S9        (days)
        │  (D1 may already be a breach; it is a dashboard check)
        ▼
P1  Auth keystone            ── P1.1 token migration
        │                       → P1.2 kill anon-admin (S1)
        │                       → P1.3 verify_jwt=true + public/health split (S3, closes S2)
        │                       → P1.4 object-level authz (S2/S6/S7)
        │                       → P1.5 suspension enforcement
        ▼
P2  Real guardrails          ── A1 depcruise · A2/A3 errors+tracing · A5 validation · A6 decompose
P3  Data layer               ── S5 bounded reads · D-model tables · A10 super-admin
P4  Quality & release        ── A8 backend coverage+smoke · A9 e2e · A4 wizards · A11 CI · A12-15 cleanup

New feature work: resumes after P1 lands. P2–P4 run as parallel tracks.
```

**Why this order.** P0 stops active bleeding with small, local changes. P1 is
the keystone — until the anon key stops being an admin credential, every other
authz fix can be bypassed, so it must precede the object-level work that depends
on it. P2 makes the _automated_ guardrails real so that P3/P4 and all future
feature work can't silently regress (fixing A1 in particular converts "trust me"
into "the gate says so"). P3 lifts the scaling ceiling before data volume forces
it. P4 buys durable release confidence so you can move fast without re-breaking
P0–P3.

---

## 7. What this unlocks for feature work

You asked to keep building. The honest answer is that **P0 + P1 should land
first** — roughly the near-term, and mostly backend/auth work that doesn't
block frontend feature design. Once the auth keystone is in:

- New client-data features inherit real object-level authorization instead of
  re-deriving it per handler.
- New routes are protected by a gateway that verifies JWTs, so "forgot to add
  `requireAuth`" stops being a data-breach-class mistake.
- The depcruise fix (P2/A1) means new modules that reach across boundaries fail
  CI instead of accruing silent debt.

I'd recommend treating P0/P1 as a focused hardening sprint, then building new
features on the P2 guardrails as they land — rather than pausing everything
until P4 is done.

---

## 8. Ledger corrections

`docs/PRODUCTION-READINESS.md` is unusually honest, but three claims are now
known to overstate reality and should be corrected there:

1. **"`npm run depcruise` — No violations (4683 modules… cruised)"** read as
   "boundaries are clean" but was vacuous — the cruise resolved **no first-party
   TS files** (49/52 deps `couldNotResolve`), so the boundary rules never fired.
   _Fixed 2026-08-21 (Stage A):_ the resolver now works (2492 real modules) and
   surfaces **210 real violations** as `warn`. Update the ledger to say the gate
   is real and non-blocking during burn-down, not "no violations". (Finding A1.)
2. **"coverage thresholds… (statements ~31%)"** omitted that the entire
   ~136K-line backend was excluded from measurement and that ~16 marketing pages
   are silently dropped by the v8 parser, so the figure described the SPA subset
   only. _Fixed 2026-08-21 (Stage A / F4):_ the backend is measured and floored
   separately (`vitest.config.server.ts`) at **statements 13.43% / branches
   9.38% / functions 12.88% / lines 13.79%**, and the ledger now reports the two
   layers as two numbers. The v8-unparseable-pages caveat still applies to the
   SPA figure. (Findings A8, §2.)
3. **"59 warnings — mostly `max-lines` / complexity warnings"** — there is **no
   complexity rule configured** in `eslint.config.mjs`. _Measured precisely
   2026-08-21 (Stage A / F2), superseding the earlier raw-line estimate:_ the
   count is now **55** (4 dead `eslint-disable` directives removed), composed of
   `max-lines` 40, `react-refresh/only-export-components` 9,
   `no-irregular-whitespace` 2, `react-hooks/exhaustive-deps` 2,
   `no-unused-vars` 1, `prefer-const` 1 — no `no-console` at all. Note the
   `max-lines` figure is **40 files**, not the 74 that exceed 1000 _raw_ lines:
   the rule skips blanks/comments and exempts `scripts/**`. The count is now
   ratcheted against `.eslint-warning-baseline`.

Additionally, the Section 2 rubric's remaining unchecked box — "Backup, DR,
POPIA, FAIS, Sentry, CSP…" — should be split: **CSP is still absent**
(confirmed, no `Content-Security-Policy` anywhere; adoption blockers are the
`index.html` inline script and the GA `innerHTML` injection), and the security
findings S1–S11 above are POPIA-material and belong on that line as _open_, not
merely _documented_.

---

_Prepared 2026-08-21 against `main` @ `6303993`. Findings carry file:line
evidence; the four most severe were re-verified against source. This plan is
advisory — no application code was changed in producing it._
