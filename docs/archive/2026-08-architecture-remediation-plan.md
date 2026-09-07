> **ARCHIVED — superseded by [`../ROADMAP.md`](../ROADMAP.md).**
> A sequenced security-and-correctness fix list verified against `main` at commit
> `6303993` on 2026-08-21. Much of it has since landed. Kept because the roadmap
> refers to its finding IDs (S4, A5, …), which are defined here and nowhere else.
> Re-verify any item against the repository before acting on it.

---

# Navigate Wealth — Architecture Evaluation & Remediation Plan

> **Purpose.** A single, evidence-based assessment of the codebase as it
> stands on `main` (commit `6303993`, verified 2026-08-21) and a sequenced
> plan to take it from "ships and works" to genuinely first-class,
> better-than-production-grade. Written to be worked from top-down.
>
> This document complements `docs/archive/production-readiness-ledger-2026.md` (the status
> ledger). Where the two disagree, the corrections in
> [§8 Ledger corrections](#8-ledger-corrections) are authoritative — they
> are based on direct re-verification, not memory.
>
> For the **target-state architecture and codebase-organisation blueprint** —
> what "good" looks like once these fixes land, with the conventions and
> fitness functions that keep it that way — see
> `docs/archive/2026-08-architecture-enhancement-plan.md`. This plan is the sequenced _fix
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
  non-blocking) **and ratcheted against `quality/baselines/depcruise-baseline`** — CI fails if
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
  882 MB `dist/`, ratcheted in `quality/baselines/bundle-size-baseline.json` so it cannot grow._
  The fix the resolver was written for is to generate `<hash>.webp` into
  `src/assets` — `vite.config.ts:19-24` already prefers it. Weigh that against
  adding more binaries to an already-892 MB `.git`; generating at build time
  avoids the git cost.
- **S12 — Admin gate on `/tasks-digest` accepted a client-editable role — FIXED
  2026-08-22.** _(Found while consolidating auth onto `auth-mw`; a drifted copy
  of the canonical check.)_

  `tasks-digest-routes.ts` resolved the caller's role as
  `user.user_metadata?.role || user.user_metadata?.systemRole` and granted
  admin on it. `user_metadata` is **client-editable** — any signed-in user can
  call `supabase.auth.updateUser({ data: { role: 'admin' } })` — so the gate on
  `GET /tasks-digest/status` and `POST /tasks-digest/send-overdue` could be
  passed by anyone holding an account. The second route sends the overdue-task
  digest email to staff.

  This is exactly what `resolveTrustedRole` exists to prevent: `admin` and
  `super_admin` are in `PRIVILEGED_ROLES` and are never honoured from
  `user_metadata` (`constants.ts:132-135`). Four sibling modules already used
  it, with a comment saying "never from client-editable user_metadata" — this
  one had drifted. Fixed to `resolveTrustedRole`, and
  `quality/baselines/auth-implementations-baseline` now ratchets the number of modules that
  verify tokens themselves so a sixth cannot appear silently.

  Impact bounded: two admin-only routes, no arbitrary client-PII read. Rated
  HIGH rather than critical for that reason, but it is a genuine
  privilege-boundary bypass and the class of bug is the point — five copies of
  an auth check drift, and one did.

- **S16 — Form prefill was a bypass of the P1.4 authorization fix (NEW,
  2026-08-22).** `form-prefill-auth.assertPrefillClientAccess` allowed **any**
  adviser to prefill **any** client, with a docblock stating that assignment
  scoping was "intentionally not enforced".

  That was a coherent decision when it was written, because nothing else
  enforced assignment either. P1.4 changed the facts and nobody revisited it.
  Prefill reads `user_profile:{clientId}:personal_info`,
  `user_profile:{clientId}:client_keys` and `policies:{clientId}` and returns
  them as proposed field values — the same client PII the FNA family had just
  been locked down to protect.

  So an adviser refused client B's FNA could call `POST /form-prefill/resolve`
  with B's id and any valid form id, and read B's personal information, ID
  number and policies straight out of the response. Two policies disagreeing
  about the same adviser and the same client is not a stylistic inconsistency —
  it is a hole in whichever one is stricter.

  Fixed by routing prefill through the shared `client-access` policy. Denials
  are re-thrown as `intakeForbidden()` rather than surfacing `ClientAccessError`
  directly, because both prefill route files map `FnaIntakeError` to its own
  status and everything else to a 500 — letting the shared error escape would
  have turned a deliberate 403 into an opaque server fault.

  **Platform administrators are untouched**, and this was the explicit
  constraint on the change. `isPlatformAdminRole` is consulted before any
  adviser resolution runs, and `resolveTrustedRole` maps the super-admin email
  allowlist to `super_admin`, which that check admits. Both role spellings and
  the allowlist path are asserted by test rather than left to inspection —
  removing the platform-admin short-circuit fails five tests.

  The only behaviour change is that an adviser with no server-resolvable
  assignment can no longer prefill for that client. Same operational caveat as
  P1.4: if assignment records are sparse in production, advisers will see 403s
  where they previously saw data, and the shared policy logs caller id, role and
  client id on every denial precisely so that case is distinguishable from
  probing.

  **Three existing tests were asserting the old behaviour, and one of them said
  so in its own name.** `allows adviser resolve for assigned workflow client`
  never established an assignment — its `kv` mock had no `get` at all, so the
  resolver returned null. It passed because nothing consulted it. The setup now
  makes the assignment real, and the unused `_otherClientId` constant sitting in
  that file finally has the negative test it was named for.

- **A22 — The validation ratchet was counting 20 routes where satisfying it
  would have broken production (NEW, 2026-08-22).** `quality/baselines/route-validation-baseline`
  counted every `POST`/`PUT`/`PATCH` registration in the auth and e-sign
  families that had no visible schema. Twenty of the fifty-nine it was reporting
  **never read a body at all** — cancel, activate, rotate, sweep, mark-read,
  remind, and the two cron probes.

  `validateBody` calls `c.req.json()` and returns 400 when it throws, so a
  request with no body 400s. Adding it to any of those twenty to satisfy the
  ratchet would have rejected every caller. This is my own Stage B gate, and it
  is the A19 shape exactly: a mechanism that looks like it is asking for a
  safety improvement while actually asking for an outage.

  Two fixes, not one:
  1. **The ratchet now counts only routes that actually read a body**, taking
     the floor 59 → 39. A narrowing is where a floor can quietly stop meaning
     anything, so the classifier is itself gated: the excluded set must be
     non-empty _and_ smaller than half the population, and a true-positive test
     runs the real regex — not a copy — against every spelling of a body read.
     Breaking the classifier fails two tests rather than passing vacuously.
  2. **`validateOptionalBody`** was added for the seventeen routes that read
     `await c.req.json().catch(() => ({}))` — a deliberate tolerance, because on
     a PATCH route sending nothing means "change nothing". `validateBody` would
     have 400'd those too. The variant treats an absent, unparseable, or
     literal-`null` body as `{}` and validates anything that _is_ sent, so
     adopting it on a live route changes no behaviour.

  Getting the classification right took two attempts, which is worth recording:
  the first pass matched `req.json()` with literal empty parens and so missed
  `c.req.json<T>()`, undercounting body-reading routes by two and nearly
  putting a wrong number in a report. The corrected detector handles the type
  parameter.

  Four routes were then wired in the same change — `POST`/`PATCH` on
  `/api-keys` and `/webhooks`, using the strict variant on the creates and the
  tolerant one on the patches — taking the floor 39 → 35.

  _Not a finding, but worth noting for once:_ the webhook routes already run
  every submitted URL through `assertPublicHttpsUrl` on both create and update.
  A capability correctly connected.

- **S15 — The super-admin secret was compared in variable time on two of the
  three routes that check it (NEW, 2026-08-22).** `auth-admin-routes.ts` has
  three routes, all gated by the shared `SUPER_ADMIN_PASSWORD`.
  `/ensure-dev-user` compared it with `constantTimeEqual` and carried a comment
  explaining exactly why. `/create-superadmin` — the route that **creates a
  super-admin account** — and `/clear-rate-limit` used a plain `!==`.

  `!==` on strings short-circuits at the first differing byte, so how long the
  comparison takes correlates with how much of the secret the caller already
  guessed. Exploiting that across a network is hard and noisy, which is an
  argument about difficulty rather than about correctness: the correct helper
  was already imported at the top of the same file, used by one sibling, and
  the fix is one line. Two of three had simply drifted from it.

  Rated MEDIUM: real side-channel, high-value target, low practical
  exploitability. Found while adding body validation to the same three routes —
  the seventh finding in this project that surfaced from doing architectural
  work rather than from looking for bugs.

- **A21 — The signup schema was on the route nobody calls (NEW, 2026-08-22).**
  There are two signup endpoints. `POST /auth/signup` (`auth-routes.ts`) got a
  `validateBody(SignupSchema)` in Stage B. `POST /auth-signup/signup`
  (`auth-signup.ts`, mounted separately in `mount-core.ts`) had none — and it is
  the one the SPA actually calls, from both `authService.ts` and
  `SignupPage.tsx`. `POST /auth/signup` has no caller in the SPA at all.

  Not a vulnerability: the live handler does guard its four required fields by
  hand. But the gate was on the wrong door, and a reader checking "is signup
  validated?" would have found the answer yes and been wrong. Both routes are
  now validated, each against a schema derived from its own destructuring —
  they genuinely differ, so a shared schema would have been the A19 mistake
  again.

- **A20 — Every ratchet's "you can tighten this now" notice was invisible
  (NEW, 2026-08-22).** All seven baseline ratchets end with the same branch:
  the measured count came in BELOW the committed floor, so somebody fixed
  something and the floor should be lowered to lock the win in. That branch
  called `console.log` / `console.warn`.

  Under this repo's Vitest (4.1.7, default reporter) console output from a
  **passing** test is swallowed — verified by probe: a `console.warn` marker
  never reaches the terminal, a `process.stdout.write` marker always does. So
  every one of those notices was dead code. The failing half worked the whole
  time; the tightening half never told anyone anything, which is how floors
  drift upward into meaning nothing.

  It had already cost something. The moment the notices were made visible
  (shared `src/test/ratchet-notice.ts` writing to stdout), two ratchets
  immediately reported slack that had been sitting unnoticed: direct
  `kv_store` importers at 175 against a floor of 176, and raw `fetch()` calls
  at 185 against a floor of 187. Both floors were tightened in the same change.

  Small bug, but it is the house failure mode in miniature — a gate that looks
  like it reports and does not.

- **A19 — Six e-sign schemas are written against an API shape that does not
  exist (NEW, 2026-08-22).** `esign-validation.ts` defines
  `EnvelopeContextSchema`, `SignerSchema`, `InviteSignersSchema`,
  `EsignFieldSchema`, `UpdateFieldValueSchema`, `OtpSendSchema` and
  `SignerSubmitSchema`; none is referenced anywhere.

  They are not merely unused — they are **wrong**, and dangerous precisely
  because they look ready to wire up. There are two e-sign wire formats:
  sender-facing is camelCase (`signerId`, `signatureData`), signer-facing is
  snake_case (`access_token`, `signature_data`). `SignerSubmitSchema` is written
  in the sender format for a signer route, and types `fieldValues` as a record
  where the handler iterates an **array** of `{ field_id, value }`. Attaching it
  to `/signer/submit` would reject every signature submission in production.

  This is the F8 lesson in the wild: a hand-maintained schema that can silently
  drift is worse than none, because it reports false violations and invites
  exactly the "just wire it up" change that breaks things. Either correct them
  against the handlers or delete them; leaving them is leaving a loaded trap.
  Left in place for now with a warning comment, because deleting another
  module's declarations is a separate decision from the B2 change that found it.

- **A17 — The runtime-error recorder is an awaited, non-atomic read-modify-write
  on a single KV row, now on the error path of every route (NEW, 2026-08-22).**
  _(Found by an adversarial review of the B1 change; one of 37 candidate
  findings and the only one that survived adversarial verification. NOT fixed —
  deliberately out of scope for that PR, see below.)_

  `recordRuntimeServerIssue` reads the entire issues array with
  `kv.get(RUNTIME_SERVER_ISSUES_KEY)` (`quality-issues-runtime-server.ts:113`),
  mutates it in memory, and writes the whole array back with `kv.set` (`:145`).
  `kv.set` is a bare upsert (`kv_store.tsx:21-31`) — no compare-and-set, no row
  lock. It is `await`ed inside the handler (`error.middleware.ts:134`), and each
  half constructs a fresh Supabase client, so **every unexpected 500 pays two
  serialised HTTP round-trips before responding**.

  Two consequences, of quite different weight:
  1. _Lost updates_ — **low**. Concurrent writers read the same snapshot and
     last-write-wins, so occurrence counts under-report during exactly the
     incident the dashboard exists to surface. Ground truth is NOT lost: the
     full message, name and stack go to stderr first (`error.middleware.ts:72`,
     `:124-128`), and the module already declares that it swallows failures. The
     dashboard is an aggregation, not the system of record.
  2. _Latency and self-amplification on the error path_ — **the substantive
     half**. During a downstream outage, every 500 adds two round-trips to the
     same Supabase project that is already degraded.

  **Why B1 matters here even though the code is unchanged:** B1 widened the
  population reaching this from the ~50 `asyncHandler` modules to every route
  behind the 77 lazy mounts. The defect is pre-existing; its blast radius is
  not.

  **Fixes, cheapest first:** (a) stop `await`ing the recorder in the request
  path — use the edge runtime's background-task hook rather than blocking the
  response (the existing `await` is justified by isolate suspension, which such
  a hook addresses properly); (b) coalesce in-isolate writers behind a
  module-level promise chain, which removes same-isolate lost updates for free;
  (c) if cross-isolate accuracy matters, move occurrence counting off the single
  JSONB row to per-fingerprint keys or a Postgres atomic upsert. Do NOT add CAS
  to `kv_store` for this alone.

- **A18 — `index.tsx`'s root error handler has no test coverage (NEW,
  2026-08-22).** `index.tsx` calls `Deno.serve(app.fetch)` at module scope, so
  the module cannot be imported by a test without starting a server. The root
  `onError` added by B1 — including its fallback path and its `x-request-id`
  stamp — is therefore asserted by nothing. It covers only the three health
  probes and throws inside lazy-router's proxy handler, so the exposure is
  small, but "small and untested" is still untested. The fix is to extract the
  app construction into a `createApp()` module that `index.tsx` imports and
  serves, which makes the whole entry point testable; that is a structural
  change and belongs with the bounded-context split (§3), not bolted onto B1.

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

  **A16b — the same editor came back through the back door — FIXED
  2026-08-29.** Dropping the named `vendor-tiptap` chunk (above) did not get
  TipTap out of the eager graph; it moved it. `getManualChunk` asked
  `id.includes('/react/')`, which is a substring test, not a package test, and
  `node_modules/@tiptap/react/…` contains `/react/`. So `@tiptap/react` was
  pinned into `vendor-react` — the one chunk every visitor must download,
  because React is in it — and Rollup followed with its exclusive dependency
  graph. A build measured on 2026-08-29 found `vendor-react` was 936 KB of
  rendered module bytes, of which React and React-DOM were 141 KB and
  prosemirror-view, prosemirror-model, prosemirror-transform, prosemirror-state,
  prosemirror-commands and `@tiptap/core` were 795 KB. `/react-dom/` caught
  `@floating-ui/react-dom` the same way.

  A second, independent instance of the same class: `vendor-feedback` grouped
  `motion` with `sonner`. `sonner` is eager — `AppProviders` mounts the app-wide
  `<Toaster/>` — while all 11 `motion` importers sit behind lazy routes, so the
  toast dragged 383 KB of animation library onto first paint.

  **Fix.** Chunk rules now match the package name parsed out of the module id
  rather than a path substring, so a rule for `react` means the `react` package.
  `motion` moved to its own `vendor-motion`; TipTap/ProseMirror to
  `vendor-editor`. No application code changed and `totalJsBytes` moved +0.3%,
  so nothing was deleted or duplicated — the weight moved off the critical path.

  | Metric                     | Before   | After        | Change     |
  | -------------------------- | -------- | ------------ | ---------- |
  | Eager entry (uncompressed) | 1.82 MB  | **1.44 MB**  | **−20.8%** |
  | Eager entry (gzipped)      | 489.7 KB | **369.2 KB** | **−24.6%** |

  **Lesson worth keeping, sharper than the first one:** a substring test over a
  module path is not a package test, and the failure is silent — the chunk still
  builds, still works, and only a size measurement tells you a marketing visitor
  is downloading an admin editor. Also: grouping an eagerly-mounted component
  with a lazily-used library in one manual chunk makes the whole chunk eager.

  Measured and rejected in the same pass: letting Rollup place `@radix-ui/*`
  automatically instead of grouping it into `vendor-ui`. It is worse — 369 KB →
  554 KB gzipped across 13 preloads instead of 9. The note is in
  `vite.config.ts` so it does not get re-tried.

- **A8 — Backend is 8.6% test-file-covered and 0% coverage-measured, and
  deploys with only a non-blocking, credential-gated smoke test.** Combined with
  A2, ~136K lines ship to production essentially unverified.
  _Measurement half FIXED (Stage A / F4, 2026-08-21):_ the backend is now
  measured and floored separately via `quality/vitest.config.server.ts` —
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
  `quality/baselines/npm-audit-baseline` (floor 1: dev-only `sharp`). **Still open:** two fake CI
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

1. **P1.1 — Frontend auth-token migration.** _(STARTED 2026-08-22: the central
   client is done and the backlog is ratcheted at
   `quality/baselines/anon-key-bearer-baseline` = 78. See the note below.)_ Stop sending the
   public anon key as a bearer token when unauthenticated. Introduce
   an explicit notion of _public_ endpoints (quote/contact/consultation) that
   need no bearer, versus _authenticated_ endpoints that must have a real JWT or
   fail. Migrate the known offenders that rely on the anon key
   (`communication/api.ts`, `WillDraftingFlow.tsx`, the 7 quote wizards, the 41
   `pages/*.tsx` raw fetchers).
   _Gate:_ no SPA code path sends `publicAnonKey` as `Authorization` for an
   authenticated route; the app still boots and public forms still work.

   **The sequencing in this plan was overtaken by events, in a way that made
   P1.1 safer.** This item said P1.2 should wait for it ("Delete
   `fna-auth.ts:85-89` once P1.1 lands"), because removing the server's
   anon-key-as-admin branch would break the frontend callers relying on it.
   Main's PR #207 did P1.2 **first**. The consequence is that the anon key is
   now authenticated by no route at all — so removing it from the SPA is pure
   cleanup with no behavioural coupling, where under the original order it
   would have been a coordinated flip.

   **S13 — `communication` file upload has never worked.** Found while doing
   this. `communication/api.ts`'s `uploadFile()` sent
   `Authorization: Bearer ${publicAnonKey}` to `POST /communication/upload`,
   which has carried `requireAuth, requireAdmin` since the file was created
   (`communication-routes.ts:88`, commit `8440657`). The anon key is not a
   credential, so the call always 401'd: attaching a file to a communication
   has never once succeeded. Not a regression from #207 — dead on arrival, and
   invisible because a 401 on a request that _is_ carrying a token reads like a
   session problem rather than a wiring bug. Its unit test asserted
   `expect(options.headers.Authorization).toContain('Bearer')`, which passed on
   the anon key, so the test certified the broken call as working. Fixed by
   routing through the shared client, and the test rewritten to assert the
   behaviour instead.

   **Remaining: 78 call sites across ~47 files.** They are not equivalent — some
   hit genuinely public endpoints (send no bearer), some hit authenticated ones
   (send a real token; those calls are currently broken like S13 was). Each needs
   reading, so the count is floored rather than banned.

2. **P1.2 — Remove the anon-key-as-admin branch (S1).** _(DONE 2026-08-22 —
   but the branch this item was written to delete was already gone, and what
   was actually wrong was something else.)_

   **The stated premise was stale.** `fna-auth.ts` no longer compares the
   bearer token against `SUPABASE_ANON_KEY`, and `authenticateUser` returns ids
   straight from Supabase Auth. `isSyntheticAdminUser` (`user.id === 'admin'`)
   survives as the vestige of the removed branch and is now unreachable:
   `FNAAuthUser` is constructed nowhere outside `fna-auth.ts`, and a real
   Supabase id is a UUID. This is the **fourth** plan item whose premise had
   moved by the time it came up, which is itself the finding — a remediation
   plan is a snapshot, and every item needs re-verifying before it is acted on.

   **What was actually wrong: five hand-rolled token verifiers, none of which
   applied the account-security policy.** `quality/baselines/auth-implementations-baseline`
   capped how many copies exist and said nothing about whether a copy is
   _correct_. Four of the five — `ai-intelligence.tsx`, `ai-advisor.ts`,
   `auth-routes.ts` (`GET /security-status`) and `tasks-digest-routes.ts` —
   verified the token and stopped. No `enforceAccountSecurity`. So a SUSPENDED
   or DELETED account kept full access to the AI advisor, the AI intelligence
   admin routes, the admin security dashboard and the task digest for as long
   as its JWT stayed valid, because suspending an account never invalidates an
   already-issued token.

   That is **S14 again, in four more places** — the same defect the FNA gateway
   had, found the same way, and a direct demonstration that a count ratchet is
   not a policy check. Fixed by calling `enforceAccountSecurity` in each,
   mapping `AuthError` to its own `statusCode`/`code` rather than flattening it
   into a 401.

   `tasks-digest` was the awkward one. Its JWT branch sits inside a bare
   `catch {}` that falls through to a generic 401, and `error.middleware` does
   not know auth-mw's `AuthError` — so swallowing would have produced "log in
   again" for a suspended admin (a loop that cannot succeed) and rethrowing
   would have produced an opaque 500. The denial is therefore answered in place
   with its own status and code.

   **Two role sources besides `resolveTrustedRole` were checked and cleared.**
   `ai-intelligence.tsx` and `auth-routes.ts` grant admin from the KV profile
   `user_profile:<id>:personal_info.role`. That would be S12 all over again if a
   client could write it — they cannot: the one route that accepts a profile
   body strips `role`, `accountStatus`, `adviserAssigned` and `suspended` for
   non-admin callers, with the reasoning already in the code. Every other write
   path is admin- or service-only. Left as-is.

   **Deliberately not changed.** `form-prefill-auth.assertPrefillClientAccess`
   is a _looser_ policy than `client-access` — any adviser may prefill any
   client, assignment scoping intentionally not enforced, documented as such at
   a single chokepoint. It is a decision, not drift, so it was not "fixed".
   Worth flagging to the product owner though: after P1.4, an adviser can
   prefill a form for a client whose FNA they can no longer read.

   _Gate:_ two static and one behavioural, all mutation-checked.
   (1) Every module that calls `auth.getUser(` must also call
   `enforceAccountSecurity` — this is what the count ratchet could not say.
   (2) No file may compare a bearer token against an anon key, and `fna-auth`
   may not construct a user with `id: 'admin'` — the shape S1 took, so it
   cannot be reintroduced as a convenience. Both carry sanity checks so they
   cannot pass vacuously. (3) Six tests drive the real `tasks-digest` router:
   a suspended admin gets 403 `ACCOUNT_SUSPENDED`, a deleted one 403
   `ACCOUNT_DELETED`, a clean non-admin still gets the original 401, and an
   unreadable security store gets 503 rather than being read as "nobody is
   suspended". Removing the enforcement call fails 3; flattening the AuthError
   into a 401 fails 3.

   _Still outstanding on this item:_ making `fna-auth.authenticateUser`
   delegate to `auth-mw` outright, which would take the verifier count from 5
   to 4. Not done here — the two gateways now apply the same policy, so the
   remaining duplication is a maintenance concern rather than a security one,
   and collapsing them touches every FNA route's error contract.

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
4. **P1.4 — Object-level authorization (S2/S6/S7).** _(DONE 2026-08-22 for the
   e-sign and FNA halves; `documents.tsx` was already fixed on main by #207, and
   the `admin-audit-service` wiring is still outstanding — see below.)_

   **S6 — the e-sign half: eight handlers that authenticated and then discarded
   the answer.** Three download routes, three audit routes and two field routes
   opened with `const _ctx = await getAuthContext(c);` — the underscore an
   explicit acknowledgement that the answer was unused — and then served any
   envelope's signed PDF, audit trail, certificate, evidence pack or field
   definitions to any caller who knew an envelope id.

   `assertFirmAccess` already existed to stop precisely this and had **zero call
   sites**. That is the **fourth** instance of the same pattern in this codebase:
   a capability written, tested by nothing, wired to nothing, and then trusted by
   whoever read its name. (The others: `security.middleware.ts`, 113 lines and 0
   importers, whose docblock called itself "the authoritative suspension check";
   six e-sign Zod schemas, unused _and_ in the wrong wire format; and
   `performSecurityCheck`/`checkAccountSuspension`, 0 call sites.) The recurring
   lesson is that a capability nobody calls is worse than a missing one, because
   it reads as coverage.

   Fixed with a shared `requireOwnedEnvelope` in `esign-route-helpers.ts` that
   loads the envelope and runs `assertFirmAccess` before the handler sees it, and
   a `firmScopeResponse` that renders the denial as a bare 403. An envelope with
   **no `firm_id`** is denied rather than allowed, with a distinct log line: the
   creation path requires a firm id, but two services already defend against its
   absence, so a legacy envelope is possible and "unowned" must not mean
   "unguarded".

   **S7 — the FNA half, which was larger.** Thirty-three handlers across risk
   planning, medical, retirement, tax, investment, estate planning, wills, and
   the two AI chat services (`will-chat`, `tax-agent`) called
   `await authenticateUser(...)` and threw the user away, then read, wrote,
   published, archived or hard-deleted whatever `:clientId` / `:fnaId` /
   `:sessionId` / `:willId` / `:docId` the caller named. Any signed-in account
   could read any client's cover analysis, medical FNA, retirement projection,
   will, tax documents or AI interview transcript. `DELETE /medical-fna/delete/
:fnaId` did not even load the record first — it went straight to `kv.del`, so
   there was nothing to check an owner against.

   Two handlers that _did_ capture the user were no better: `PUT /update/:fnaId`
   and `POST /publish/:fnaId` captured it only to stamp `createdBy`/`publishedBy`
   and never asked whether that user was allowed near the record. That is why the
   gate for this is structural (below) and not just the discard ratchet — the
   next variant of this mistake will capture the user.

   **One policy, two adapters.** The rule already existed in `client-access.ts`
   and was already enforced on `advice-engine-fna-routes.ts` and
   `client-management-documents-routes.ts`: self, or platform admin, or the
   server-resolved _assigned_ adviser; every other personnel role denied.
   `client-access.ts` now exposes a context-free `canAccessClientAs` core, with
   the Hono-context form as a thin adapter over it, plus `assertClientAccess` /
   `assertRecordClientAccess` that throw a `ClientAccessError` the existing
   `fnaErrorResponse` catch renders as 403 `FORBIDDEN_CLIENT`. Writing a second
   copy of the policy for the FNA gateway is exactly the drift that produced S12
   and S14, so it was not done.

   Three consequences worth stating plainly:
   - **Operational.** Advisers now need a resolvable assignment
     (`user_profile:<clientId>:personal_info.adviserId`, or an application
     record) to reach a client's FNA data. This is already true on the
     advice-engine and client-document routes, so it is consistency rather than
     a new rule — but if assignment records are sparse in production, advisers
     will see 403s where they used to see data. Denials log at `warn` with the
     caller id, role and client id specifically so "attacker" and "adviser with
     a missing assignment record" can be told apart, which a bare 403 cannot.
   - **Fail-closed on unowned records.** A stored FNA with no `clientId` is
     denied, to an administrator included, for the same reason as the missing
     `firm_id` case.
   - **Still open, deliberately.** Three `/client/:clientId/latest-published`
     routes (medical, investment, estate) keep a documented anon-key bypass for
     the client portal, each with its own weaker inline check that admits admins
     and self but not advisers. Removing it breaks client-facing display until
     the portal passes a session token; P1.3 addresses it structurally. They are
     named individually in the coverage gate's `EXEMPT` map with their reason,
     so the exemption is visible rather than an absence.

   Five hand-rolled `message === 'Unauthorized' ? 401 : 500` catches in the tax,
   investment, estate-doc and chat route files were replaced with
   `fnaErrorResponse`, which is a strict superset of that mapping — without it a
   403 denial would have been rendered as a 500.

   _Gate:_ three layers, all mutation-checked. (1) 15 policy tests over
   `canAccessClientAs` / `assertClientAccess` / `assertRecordClientAccess`,
   including fail-closed on a missing caller id, a missing owner, and an
   unassigned adviser. (2) 17 route-level tests that drive the real routers and
   assert both the 403 _and_ that `kv.set`/`kv.del` never ran — a 403 rendered
   after the write would be a leak dressed as a denial. (3) A structural sweep
   requiring every resource-keyed handler in all ten FNA route files to call the
   shared policy, which is what catches route number 34. Removing any of: the
   ownership check on a route, the caller-id guard, the unowned-record guard, or
   the `ClientAccessError` branch in `fnaErrorResponse` fails 2–3 tests each.
   `quality/baselines/auth-without-authz-baseline` moved 31 → 33 when the ratchet was widened to
   count `authenticateUser` discards as well as `getAuthContext` ones; the two
   survivors are the `/status` endpoints on will-chat and tax-agent, which take
   no resource id.

   _Still outstanding on this item:_ wiring `admin-audit-service` into the
   export and delete paths, so that a denied — or permitted — delete leaves a
   row. Not done here; it is a separate concern from the authorization check
   itself.

5. **P1.5 — Enforce account suspension.** _(DONE 2026-08-22, but not the way
   this item described — see below.)_

   The premise here was wrong in a useful way. It said to wire
   `performSecurityCheck`/`checkAccountSuspension` into the request path. Those
   live in `security.middleware.ts`, which had **zero importers** and whose own
   docblock claimed "CRITICAL: This is now the authoritative suspension check"
   — authoritative for nothing. Meanwhile `auth-mw.ts`'s
   `enforceAccountSecurity` had been doing the job correctly on every auth-mw
   route the whole time. Wiring up the dead pair would have created a second,
   divergent policy, which is exactly the drift that produced **S12**.

   **S14 — a suspended user kept full access to the FNA family.**
   `fna-auth.authenticateUser` — the gateway for **14 modules** covering FNA,
   tax, estate planning, wills and form-prefill, i.e. client financial and
   medical data — validated the token, resolved the role, and stopped.
   Suspending an account does not invalidate an already-issued JWT, so
   "suspended" meant nothing there until the token expired on its own.

   Fixed by exporting `enforceAccountSecurity` and calling it from
   `fna-auth`, so both gateways apply one policy. The rejection now also
   survives to the client with its status and code intact (`AuthError` is
   matched structurally in `fnaErrorResponse` rather than by message text) —
   flattening it to a generic 401 would tell a suspended user to log in again,
   sending them round a loop that cannot succeed.

   `security.middleware.ts` (113 lines, 5 exports, 0 importers) was deleted
   rather than corrected: a module that falsely advertises itself as the
   authoritative security check is a trap for whoever reads it next.
   _Gate:_ a suspended user's existing JWT is rejected on the FNA gateway;
   nine tests cover suspended / deleted / stale-2FA / within-grace / clean, and
   the status-and-code mapping. Both the enforcement call and the AuthError
   pass-through are mutation-checked.

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
   allowlist ratchet like `quality/baselines/deno-check-baseline`); delete the two fake test
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

`docs/archive/production-readiness-ledger-2026.md` is unusually honest, but three claims are now
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
   separately (`quality/vitest.config.server.ts`) at **statements 13.43% / branches
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
   ratcheted against `quality/baselines/eslint-warning-baseline`.

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
