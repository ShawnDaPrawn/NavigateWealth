# Navigate Wealth — Refactoring Roadmap

> **What this is.** The single, current answer to _"what would we do to reduce
> technical debt, improve readability and code organisation, and make this
> application top-quality production grade?"_ — verified against `main` at
> commit `255f708` on 2026-08-22, after the Stage A/B/C architecture work and
> the P1 auth keystone landed.
>
> **How it relates to the other docs.** This roadmap does not replace them; it
> consolidates what _remains_ after their partial execution:
>
> - `docs/PRODUCTION-READINESS.md` — the status ledger (what is on `main`).
> - `docs/ARCHITECTURE-REMEDIATION-PLAN.md` — the security/correctness fix
>   list (P0–P4) with per-finding evidence. Finding IDs (S4, A5, …) used below
>   are defined there.
> - `docs/ARCHITECTURE-ENHANCEMENT-PLAN.md` — the target-state blueprint
>   (module contract, layering, fitness functions F1–F10, Stages A–F).
> - **This doc** — the sequenced execution roadmap for everything still open,
>   re-verified against the working tree rather than carried forward from
>   memory. Work it top-down; tick items off here and in the ledger.
>
> **Rule inherited from both plans:** every item below must be re-verified
> against source before acting on it. Four remediation items were stale by the
> time they were picked up; treat this snapshot the same way.

---

## 1. Where we actually are (verified 2026-08-22, HEAD `255f708`)

### 1.1 What is already done — do not redo, do not regress

The heavy lifting of the last two months is real and enforced in CI
(`.github/workflows/quality-check.yml`):

- **Fifteen enforced ratchets/floors are live** — the twelve baseline files in
  §1.2 (lint warnings, Deno type errors, depcruise boundaries, npm audit,
  route-auth coverage, route validation, auth implementations,
  auth-without-authz discards, anon-key bearers, raw fetches, kv-direct
  imports, contract coverage), the six-metric bundle-size budget, and the two
  per-layer coverage floors. None of these debts can silently grow.
- **The auth keystone's server side landed** (P1.2/P1.4/P1.5): no
  anon-key-as-admin branch, object-level authorization on the FNA and e-sign
  families via one shared `client-access` policy, suspension enforced on both
  auth gateways, `/documents` guarded, `/tasks-digest` on `resolveTrustedRole`.
- **Backend spine seeded** (Stage B): global `onError` across all 77 lazy
  mounts, request-id in every log line via AsyncLocalStorage,
  `validateBody`/`validateOptionalBody`, a typed `repositories/` base with
  bounded reads, `src/shared/contracts` with its first real adopter.
- **Structural wins**: `integrations.tsx` split into seven route modules,
  Deno check burned to 0, `quality/baselines/eslint-warning-baseline` 55, eager entry −24%
  (A16), `react-toastify` deleted and banned (A12).

Anything in the "do not regress" list of the remediation plan §3 stays binding:
strict types, the API client, lazy-router, code splitting,
`resolveTrustedRole`, all-DB-through-the-edge-function.

### 1.2 The measured debt that remains

| Ratchet / measure                                 | Current             | Target          | Meaning                                                            |
| ------------------------------------------------- | ------------------- | --------------- | ------------------------------------------------------------------ |
| `quality/baselines/anon-key-bearer-baseline`      | 78                  | 0               | SPA call sites still sending the public anon key as a bearer       |
| `quality/baselines/auth-implementations-baseline` | 5                   | 2               | Hand-rolled token verifiers (target: `auth-mw` + login itself)     |
| `quality/baselines/auth-without-authz-baseline`   | 33                  | ~2              | Handlers that authenticate and discard the answer                  |
| `quality/baselines/route-validation-baseline`     | 35                  | 0               | Body-reading mutating routes with no schema                        |
| `quality/baselines/route-auth-baseline`           | 123                 | reviewed list   | Routes with no visible guard (includes public-by-design)           |
| `quality/baselines/depcruise-baseline`            | 210                 | 0, then `error` | Module-boundary violations (109 cross-feature, 100 outsider-admin) |
| `.kv-direct-import-baseline`                      | 175                 | 0               | Files importing `kv_store` instead of a repository                 |
| `quality/baselines/raw-fetch-baseline`            | 185                 | ~10             | Raw `fetch()` past the API client (103 in two `api.ts` files)      |
| `quality/baselines/eslint-warning-baseline`       | 55 (40 `max-lines`) | 0 at budget 600 | Warning ratchet; file-size budget currently 1000                   |
| `quality/baselines/contract-coverage-baseline`    | 2                   | grows           | Validated response call sites (floors a gain, fails on falls)      |
| `quality/baselines/npm-audit-baseline`            | 1                   | 0               | High/critical advisories (`sharp`, dev-only, major bump)           |
| `quality/baselines/deno-check-baseline`           | 0                   | hold            | Done — keep at zero                                                |
| Backend coverage (floored)                        | ~13.7% stmts        | 40%+            | `vitest.config.server.ts`, ratchets up only                        |
| SPA coverage (floored)                            | ~31% stmts          | 50%+            | Excludes backend; per-layer by design                              |
| Files > 1,000 raw lines                           | 74 (40 counted)     | 0 at budget 600 | Readability ceiling; god files listed in §4                        |
| `src/assets`                                      | 853 MB PNG/JPG      | < 20 MB         | A7 — raw Figma exports shipped to `dist/` (906 MB images)          |
| Edge function                                     | 1 × ~136K lines     | 4–6 functions   | Stage E bounded-context split not started                          |
| E2E in CI                                         | 0 journeys          | 3 seeded        | A9 — all specs credential-skipped                                  |
| Metrics                                           | none                | minimal set     | Correlation IDs exist; no counters/latency                         |

### 1.3 Security remainder — still open at HEAD, re-verified today

These survived the P0/P1 push and are the only items below that outrank
"organisation" work:

- **S4 (partial).** `NW_ESIGN_PLATFORM_P12_BASE64` env path exists, but the
  plaintext KV fallback (`esign_config:platform_signing_cert`,
  `esign-pdf-protect.ts:47,171,200`) is still read **and written**, and the
  unbounded `GET /kv-store/:key` reader can still fetch it.
- **S8.** The signer token still rides `/sign?token=` with no analytics
  scrubber and no `history.replaceState` cleanup (no `beforeSend`/`replaceState`
  anywhere in the SPA).
- **S9 (half).** `AIWritingPanel` now sanitizes; `MarkdownPreview.tsx` still
  renders its own markdown with a working `javascript:` URI link rule.
- **S10.** `quote-request-routes.ts`, `contact-form-routes.ts`,
  `consultation.ts` still build staff-facing email HTML with **zero**
  `escapeHtml` calls on anonymous input.
- **S11 (partial).** The atomic Postgres limiter landed for auth
  (`20260821000001_atomic_auth_rate_limit.sql`); public lead-gen forms remain
  email-keyed (rotate address → unlimited) and KV limiters still fail open.
- **P1.1.** 78 anon-key bearer call sites (ratcheted, not banned).
- **P1.3.** `verify_jwt = false` — flipping it requires the `public` sibling
  function split (Stage E's first slice).
- **D2 (remainder).** `kv_store_91ed8379` has no migration file;
  `20260420000001_esign_core_tables.sql` sits unapplied in the repo — the
  migrations folder still does not tell the truth.
- **A10.** Deprecated `SUPER_ADMIN_EMAIL` const: still present with production
  call sites, including the recovery-route lockout.
- **A17/A18.** Error-path recorder is an awaited non-atomic KV read-modify-write
  on every 500; `index.tsx` remains untestable (`Deno.serve` at module scope).

---

## 2. The shape of the work

Six workstreams. **WS0 is sequenced first and is small**; WS1–WS5 are the
refactoring proper and can run as parallel tracks afterwards (or interleaved —
each item is an independent, reviewable slice). Effort: S = hours, M = 1–3
days, L = a week-plus of slices.

```
WS0  Close the security remainder      S4 S8 S9 S10 S11 · A10 · D2 · A17/A18     (mostly S/M)
WS1  Frontend organisation             boundaries · wizards · god files · app/    (L, slices)
WS2  Backend organisation              layering · god services · validation      (L, slices)
WS3  Data layer                        repositories · bounded reads · Postgres   (L, long pole)
WS4  Platform & deployability          public split · verify_jwt · esign fn ·    (M/L)
                                       metrics · P1.1 burn-down
WS5  Delivery confidence               backend tests · smoke · e2e · CI cleanup  (M, ongoing)
     Assets & bundle hygiene           A7 images · Quill CSS · dead weight       (S/M, batch)
```

---

## 3. WS0 — Close the security remainder first (days)

Refactoring on top of open exposures is polishing a house with the door
unlocked. Every item here is small, local, and already fully specified in the
remediation plan; this is the punch list with current state folded in.

> **Status 2026-08-23 — WS0 worked; 0.1–0.5, 0.8 and 0.9 are DONE, 0.6 and 0.7
> are partial.** What was completed, and the three places reality differed from
> the estimate above:
>
> - **0.1 (S10) done.** Bigger than "apply escapeHtml": `quote-request-routes`
>   has 140+ interpolation sites across seven verticals, so hand-escaping would
>   have left the next missed one as the hole. It builds its HTML from an
>   escaped view of the payload (`escapeHtmlDeep`) instead.
> - **0.2 (S11) done**, one shared limiter replacing three inline copies. Fail
>   posture is **open**, not closed as this table speculated — reasoning in
>   `public-form-rate-limit.ts`, pinned by a test. The non-atomic
>   read-modify-write is the outstanding half.
> - **0.3 (S9), 0.4 (S8), 0.8 (A17), 0.9 (A19) done** as specified. A19 was
>   five schemas, not six: `SignerSchema` and `EsignFieldSchema` back live
>   schemas and were kept.
> - **0.5 (S4) partial.** The reader is locked down (super-admin + a secret
>   denylist that refuses `esign_config:*` to everyone + audit logging). The KV
>   cert fallback is deliberately NOT deleted — the operator must confirm the
>   env secrets first, and `NW_ESIGN_REQUIRE_ENV_CERT=true` now closes the path
>   without a deploy. **Operator step still outstanding.**
> - **0.6 (A10) partial.** Not 12 call sites but ~30, across two separate
>   constants (edge _and_ SPA, and the SPA has no allowlist at all). The
>   authorization sites are migrated, including the recovery-route lockout the
>   audit named. Deliberately excluded: the login rate-limit exemption, which
>   stays keyed on the single owner identity because widening a brute-force
>   bypass is the wrong direction. **Still open:** the SPA has no
>   `isSuperAdminEmail` equivalent, ~8 display-only sites remain, and the const
>   is not deleted. Its own docblock legitimises it as _owner identity_; only
>   _authorization_ use is deprecated.
> - **0.7 (D2) partial — but now verified rather than assumed.** Checked
>   read-only against production: the drift is worse and different than
>   recorded. `20260611000001_fna_intake_rls_draft_only.sql` is **also**
>   unapplied (an H-12 RLS tightening — possibly a live security gap), applied
>   version stamps do not match repo filenames, and **seven** tables exist with
>   no migration file, not one. Findings are written up in
>   `supabase/migrations/README.md` and the unapplied e-sign migration now
>   carries a do-not-push banner. No migration files were generated:
>   reconstructing DDL from introspection would produce files that look
>   authoritative while omitting indexes, policies and constraints — the same
>   failure one level deeper. Closing it needs `supabase db pull` by someone
>   holding the credentials.

| #   | Item                                                                                                                                                                                             | Effort | Acceptance gate                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| 0.1 | **S10** — apply the existing `escapeHtml` to every interpolated field in the three lead-gen email builders                                                                                       | S      | Test injects `<script>` into each form; rendered email escapes it                                                       |
| 0.2 | **S11** — add IP dimension to the public-form limiters (mirror the login limiter); decide and document the fail posture per limiter (public forms may fail closed)                               | S/M    | Limiter test covers IP keying; posture documented in code                                                               |
| 0.3 | **S9** — sanitize `MarkdownPreview` (DOMPurify, as `AIWritingPanel` now does) and kill the `javascript:` URI rule                                                                                | S      | Tests: `javascript:` and `<img onerror>` neutralized                                                                    |
| 0.4 | **S8** — `history.replaceState` after token read; `beforeSend` scrubber for Vercel Analytics + GA `page_location` redaction for `token` and UUIDs                                                | M      | No analytics payload contains `token=`; unit test on the scrubber                                                       |
| 0.5 | **S4** — make the env var the only signing-key source: delete the KV fallback and cached row, gate `GET /kv-store/:key` behind `requireSuperAdmin` with an `esign_config:*` denylist + audit log | M      | Key unreadable via any KV route; denylist asserted by test. **Operator step first:** set both env secrets in production |
| 0.6 | **A10** — replace the 12 `SUPER_ADMIN_EMAIL` call sites with `isSuperAdminEmail()`; delete the const                                                                                             | S      | Recovery admin passes the recovery route; `grep` shows 0 references                                                     |
| 0.7 | **D2** — commit migration files asserting what production actually has (`kv_store_91ed8379` + RLS state); apply-or-delete `esign_core_tables.sql` so the folder tells the truth                  | S/M    | `supabase/migrations/` matches applied state; decision recorded in the ledger                                           |
| 0.8 | **A17** — take the runtime-issue recorder off the request path (background task hook), coalesce same-isolate writers behind a promise chain                                                      | S/M    | A thrown 500 responds without awaiting two KV round-trips; test pins it                                                 |
| 0.9 | **A19** — correct-or-delete the six drifted e-sign schemas in `esign-validation.ts` (currently a loaded trap behind a warning comment)                                                           | S      | No unused schema left that contradicts its handler's wire format                                                        |

WS0 exit: Section 1.3 above is empty except P1.1/P1.3 (owned by WS4) and
A18 (owned by WS2's entry-point refactor).

---

## 4. WS1 — Frontend organisation & readability

The SPA's problem is not structure-in-the-large (the admin module convention is
good and 27/28 modules follow it); it is **enforcement gaps and a long tail of
god files**. Work the ratchets down; never mass-rename.

### 4.1 Burn down the 210 boundary violations (F1)

- **What:** 109 cross-feature-internals + 100 outsider-admin-internals
  imports, all visible via `npm run depcruise`.
- **How:** for each violation either (a) import via the module's `index`
  barrel, (b) promote genuinely shared code to `src/shared`, or (c) add the
  missing barrel export. Start with the two named leaks that defeat
  code-splitting: `HomeDashboardPage` → admin `ClientOverviewTab` (client page
  pulling a 1,615-line admin component) and `AdminDashboardPage` → 19
  module-internal skeletons.
- **Slices:** ~10–20 violations per PR, lowering `quality/baselines/depcruise-baseline` each
  time. At 0, flip the three rules to `error` in `.dependency-cruiser.cjs`.
- **Effort:** L (mechanical after the first few).
  **Gate:** baseline reaches 0; rules at `error`; a deliberate internal import
  fails CI.

### 4.2 De-duplicate the seven quote wizards (A4)

Verified today: 7 wizards, **8,384 lines**, sharing byte-identical
`loadDraft/saveDraft/clearDraft/formatCurrency/parseCurrencyToNumber/StepIndicator`,
all raw-fetching past the API client — and this is the untested public revenue
path.

- **How:** extract `useWizardDraft` + shared `<StepIndicator>` + one shared
  submit function on the API client into
  `src/components/pages/quote/shared/`; migrate one wizard per PR with a
  submit-path test added in the same PR (test-first: capture the exact request
  payload before refactoring, assert it unchanged after).
- **Payoff:** ~2,500–3,000 lines deleted, 7 files drop below the size budget,
  `quality/baselines/raw-fetch-baseline` and `quality/baselines/anon-key-bearer-baseline` both fall, and the
  revenue path gains its first tests.
- **Effort:** M/L. **Gate:** shared module + 7 slim wizards, each with a
  submit test; ratchets lowered.

### 4.3 Split the god components (F2 burn-down)

40 files breach the 1,000-line lint budget (74 exceed 1,000 raw lines). Split
under **touch-it-you-fix-it** — when a file is opened for any other reason —
except the top of the list, which is worth scheduling because every future
change pays its reading cost. Worst offenders re-measured today:

| Raw lines | File                                                    | Note                                     |
| --------: | ------------------------------------------------------- | ---------------------------------------- |
|     2,125 | `advice-engine/components/RoAModuleContractManager.tsx` | split by contract section                |
|     1,650 | `client-management/components/clientOverviewUtils.ts`   | pure utils — easiest big win, test-first |
|     1,640 | `resources/components/EmailSignatureGenerator.tsx`      |                                          |
|     1,637 | `product-management/keyManagerConstants.ts`             | data, not code — move to JSON or split   |
|     1,615 | `client-management/components/ClientOverviewTab.tsx`    | also the §4.1 boundary leak — same PR    |
|     1,605 | `modules/wills/WillDraftingFlow.tsx`                    |                                          |
|     1,575 | `pages/quote/components/MedicalAidQuoteWizard.tsx`      | covered by §4.2 — don't schedule twice   |
|     1,523 | `client-management/hooks/useClientProfile.ts`           | split queries from transforms            |

Rules for every split: pure move first, behaviour later; keep the module's
barrel the only public surface; add or keep a characterization test. When the
`max-lines` contribution reaches 0, step the budget 1000 → 800 → 600,
re-measuring and re-baselining `quality/baselines/eslint-warning-baseline` at each step
(files between thresholds surface only when the budget steps — expect the
count to rise before it falls).

- **Effort:** L (spread). **Gate:** `quality/baselines/eslint-warning-baseline` at 0 with the
  budget at 600 and `max-lines` promoted to `error`.

### 4.4 Converge the two raw-fetch stragglers (A14, F10)

`publications/api.ts` (76 raw fetches, 1,441 lines) and `social-media/api.ts`
(27) hold 103 of the 185 raw-fetch sites. Migrate them onto the shared API
client endpoint-by-endpoint (each endpoint is a tiny, testable diff), which
also gives those modules retry, 401-refresh, and typed `APIError` for free.

- **Effort:** M each. **Gate:** `quality/baselines/raw-fetch-baseline` drops ~103; the
  remaining legitimate sites (signer-facing anon calls) are individually
  commented.

### 4.5 Consolidate the app shell into `src/app/` (Stage A leftover)

Still not done (no `src/app/` exists). Move `App.tsx`, `AppRoutes.tsx`,
`src/router/`, and the provider tree into `src/app/` — a small, high-value
discoverability move that was explicitly scoped as safe. Nothing else
relocates.

- **Effort:** S/M. **Gate:** build + tests green; imports updated; no
  behaviour change.

### 4.6 Shared contracts adoption (Stage C continuation)

`src/shared/contracts` has its mechanism, its ratchet, and one adopter. Grow
it along the seams that already burned us: the client profile, envelope, and
publications/advice-engine responses — the last two because their hand-written
`types.ts` files (1,291 and 1,287 lines) are the drift risk F8 exists for.
43 scattered `types.ts` files under `src/components` re-export from contracts
as they are touched; duplicated shapes are deleted, not maintained.

- **Effort:** M (ongoing). **Gate:** `quality/baselines/contract-coverage-baseline` rises with
  each adoption; publications/advice-engine `types.ts` shrink to re-exports.

### 4.7 Dead weight and readability batch (A13, A15)

One cleanup PR each: scope the 1,056 lines of Quill CSS out of `src/index.css`
into the editor component; delete `src/imports/` strays
(`client-report-overview.txt`, `linkedin-share-guide.md`) and the unused
`figma/ImageWithFallback.tsx`; converge on one DnD library
(`@hello-pangea/dnd` — `react-dnd` has 2 importers); reconcile `src/public/`
vs `public/`.

- **Effort:** S each. **Gate:** homepage no longer ships editor CSS; one DnD
  dependency; `npm run build` output unchanged elsewhere.

---

## 5. WS2 — Backend organisation & readability

The edge function's target layering is `transport → service → repository →
store` (enhancement plan §3). The layer exists; the migration doesn't. Three
moves matter:

### 5.1 Finish the auth consolidation (5 → 2 verifiers)

`fna-auth.authenticateUser` is the real merge candidate: both gateways now
apply the same suspension policy, so delegating `fna-auth` to `auth-mw` is a
maintenance refactor, not a security fix — but it touches every FNA route's
error contract, so do it as its own PR with the existing 9-test suspension
suite as the harness. The AI modules' adviser-book checks become
authorization adapters over `auth-mw` rather than parallel verifiers.

- **Effort:** M. **Gate:** `quality/baselines/auth-implementations-baseline` 5 → 2 (auth-mw +
  the login endpoint itself); all FNA/suspension tests green unchanged.

### 5.2 Split the god services along the layering (§3.2)

Current worst, re-measured: `resources-service.ts` (1,725),
`honeycomb-service.ts` (1,613), `quote-request-routes.ts` (1,580),
`ai-advisor.ts` (1,443), `communication-service.ts` (1,387),
`integrations-portal-worker-routes.ts` (1,142). Split by responsibility, not
line count — each becomes `*-routes` (transport) + `*-service` (logic) +
`*-repository` (data), following the proven `integrations.tsx` playbook: one
route group per PR, pure move first, same response shapes, contract test
before and after. `quote-request-routes.ts` doubles as WS0's S10 fix — do the
escaping first, split second.

- **Effort:** L (slices). **Gate:** no server module above the current lint
  budget; each split lowers `quality/baselines/eslint-warning-baseline`.

### 5.3 Burn down the validation ratchet (A5/A22 continuation)

35 body-reading mutating routes remain unvalidated. Derive each schema from
the handler's own destructuring (the A19 lesson: never write the schema from
imagination), use `validateOptionalBody` where absent-body tolerance is
load-bearing, ~5 routes per PR.

- **Effort:** M. **Gate:** `quality/baselines/route-validation-baseline` → 0; malformed bodies
  get typed 400s on every mutating route.

### 5.4 Make the entry point testable (A18)

Extract `createApp()` from `index.tsx` so `Deno.serve(createApp().fetch)` is
the only module-scope side effect. This puts the root `onError`, the health
probes, and mount-failure behaviour under test, and is the natural first PR of
the Stage E split (both need the app factored out of the serve call).

- **Effort:** S/M. **Gate:** root error handler has direct tests; boot
  behaviour asserted (a failed mount is no longer silently swallowed).

### 5.5 Review the route-auth list (F3)

`quality/baselines/route-auth-baseline` = 123 is a **review list**, not a vulnerability count.
Classify every entry once: public-by-design (annotate in the test's expected
set), guarded-but-invisible (improve the detector), or genuinely unguarded
(fix). The number then becomes meaningful and the annotated list becomes the
public-API inventory the P1.3 split needs.

- **Effort:** M. **Gate:** every one of the 123 carries a classification;
  unguarded count is 0.

---

## 6. WS3 — Data layer (the scaling ceiling, long pole)

Sequenced after WS0; runs in parallel with WS1/WS2. The order inside matters:

1. **Repositories first (S5 enabler).** Migrate the hot read paths —
   `reporting-service` dashboard, tasks, publications-admin — onto the seeded
   repository layer with bounded, paginated reads and explicit truncation
   handling. Then work `.kv-direct-import-baseline` (175) down
   namespace-by-namespace; each migrated namespace is a small PR.
   _Gate:_ no unbounded `getByPrefix` on any request path (make this the F9
   test); a scale test asserts correct behaviour past 1,000 rows.
2. **Promote entities to Postgres (Stage D).** `clients` → `applications` →
   `tasks` → `policies` → `communications`, each via the proven FNA-intake
   pattern: migration + RLS → dual-write → backfill → read-flag → cutover.
   Because reads go through repositories by then, each cutover is a repository
   swap, not a 175-file edit. One entity per epic; `clients` first (highest
   query pressure, most cross-feature reads).
   _Gate per entity:_ migration + RLS committed, backfill script, flag
   cutover, KV path retired.
3. **KV stays** for genuinely schemaless/ephemeral state (drafts, rate-limit
   counters, job markers) — that is the design, not a compromise.

- **Effort:** L/L. This is the largest engineering item in the roadmap;
  everything else gets cheaper once it exists (dashboards stop loading entire
  namespaces into one isolate).

---

## 7. WS4 — Platform, deployability & the last of the keystone

1. **P1.1 burn-down (78 → 0).** Classify each anon-key bearer call site:
   genuinely public endpoint → send no bearer; authenticated endpoint →
   migrate to the shared client (those calls are currently broken the way S13
   was — expect to find more dead features). The §4.2 wizard work and §4.4
   convergence remove a large fraction for free.
   _Gate:_ `quality/baselines/anon-key-bearer-baseline` → 0, then ban the pattern outright.
2. **Stage E, slice 1 — the `public` function.** Move health plus **every
   route that must work without a user session** into an unauthenticated
   sibling function. The current `PUBLIC_ROUTERS` allowlist
   (`router-auth-guard.test.ts`) is the verified starting inventory —
   `auth-signup.ts` (**account creation: the SPA posts to
   `/auth-signup/signup` before any JWT exists — leaving it behind the flip
   breaks signup outright**), the three lead-gen forms
   (quote/contact/consultation), the RSS proxy, and the static FNA directory
   — plus the token- and secret-authenticated routes that carry no user JWT
   (`sign-by-token` signer access, the openclaw webhook, the portal-worker
   secret routes need the same review). The §5.5 route classification is the
   authoritative, complete inventory; do not flip on this named list alone.
3. **P1.3 — flip `verify_jwt = true`** on the main function once slice 1
   serves the public surface. This structurally closes the "auth by
   convention" posture (S3) — the gateway rejects tokenless requests before
   Hono runs.
   _Gate:_ unauthenticated requests to business routes 401 at the gateway;
   **signup**, public forms, signer links, and health all work from the
   sibling — signup and one lead-gen submit are part of the post-flip smoke;
   live smoke passes on both functions.
4. **Stage E, slice 2 — carve out `esign`** (heaviest cold path, most
   compliance-sensitive), converting the heavy PDF/crypto libraries to dynamic
   imports at their routes. Measure cold-start before/after. Further splits
   (`integrations`, `ai`) only if deploy-blast-radius or cold-start data says
   so — six functions is the ceiling, not the goal.
5. **Metrics (the deliberately-deferred half of Stage B).** Choose the sink
   deliberately — Supabase log drains vs. the in-house quality-issues store vs.
   an OTLP endpoint — then emit request/error counters and p50/p95 per route
   family from the shared middleware. Correlation IDs already exist; this is
   the other half of "can we answer what happened to request X, and how often".
   _Gate:_ a dashboard (even a script) can answer error-rate and latency per
   route family for the last 24h.

- **Effort:** M/M/M/M/M — each slice independent and reversible.

---

## 8. WS5 — Delivery confidence (tests, smoke, CI)

1. **Blocking post-deploy smoke** in `deploy-supabase-function.yml`: hit
   health + 2–3 gated routes, assert 200/401, fail the deploy on red, with a
   documented rollback. The backend still deploys ~136K lines on faith; this
   is the single cheapest release-confidence win in the whole roadmap.
   _Effort:_ S/M.
2. **Backend coverage ratchet, worked not watched.** Floors only prevent
   regression; the plan is contract tests. Every route family gets an
   `*-routes.contract.test.ts` (mount the real router, mock only IO, assert
   status/authz/validation) — required for new routes, added for existing ones
   as WS2 touches them. Ratchet `vitest.config.server.ts` floors upward on
   every land. Target: 40% statements by the time Stage D's first entity cuts
   over.
   _Effort:_ ongoing, absorbed into WS2/WS3 PRs.
3. **One real e2e journey in CI (A9).** Programmatically seed (bootstrap-UAT
   scripts already exist for FNA), then run login + quote submit + the e-sign
   round trip against a preview deploy on PRs. Start with one journey required
   in CI; grow to three.
   _Effort:_ M.
4. **CI hygiene remnant (A11 tail).** The FNA-intake and form-prefill CI steps
   still write `.exit` files nothing reads (their suites also run inside the
   main test step — it's redundancy theatre, not coverage). Either enforce
   those two exits or delete the steps. Add `continue-on-error` to the
   quality-snapshot publish so a Supabase blip cannot fail every PR.
   _Effort:_ S.
5. **Component-test rebalance** — under touch-it-you-fix-it, upgrade
   mount-only tests to behaviour tests when their component is next edited.
   No scheduled sweep.

---

## 9. Assets & bundle hygiene (batch, high visual payoff)

- **A7 — the 853 MB of raw Figma images** (`src/assets`, 154 files; 906 MB of
  images in `dist/`). Generate hashed `.webp` **at build time**, into the
  shape the resolver actually looks for. **Note the existing pieces do not
  yet connect:** the `figmaAssetResolver` in `vite.config.ts` prefers exactly
  `src/assets/<hash>.webp`, while `scripts/optimize-images.mjs` writes
  `<hash>-<width>.webp` under `public/img/optimized/` — so merely wiring
  `optimize:images` into `npm run build` changes nothing that
  `figma:asset/<hash>.png` imports resolve to. The fix is a pre-build step
  that emits `<hash>.webp` where the resolver expects it (or teaches the
  resolver/optimizer one shared contract), preferably to a git-ignored
  location rather than committing more binaries to an already-892 MB `.git`.
  Then step `imageBytes` in `quality/baselines/bundle-size-baseline.json` down an order of
  magnitude so it can never return. Consider `git filter-repo` on the worst
  blobs only as a separate, explicitly-approved operation.
  _Effort:_ M. _Gate:_ `imageBytes` < 50 MB; largest emitted image < 500 KB;
  no 28 MB PNG reachable from any route.
- **Bundle budget steps.** After A16's −24%, ratchet `entryGzipBytes`
  deliberately downward (e.g. 496 KB → 400 KB) as Quill CSS scoping (§4.7)
  and image work land, instead of only preventing growth.

---

## 10. Suggested sequencing

Dependency-ordered, not calendar-ordered; each cell is a stream of small PRs
under the AGENTS.md finalization protocol (verify locally → PR → auto-merge).

| Order        | Do                                                                                                                  | Why now                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Now**      | WS0 punch list (0.1–0.9)                                                                                            | Open exposures; every item small and fully specified     |
| **Next**     | §5.4 `createApp()` · §8.1 blocking smoke · §8.4 CI tail · §4.5 `src/app/` · §4.7 + §9 hygiene batch                 | Cheap, independent, unlock testing + Stage E             |
| **Then**     | §4.2 quote wizards · §4.4 raw-fetch convergence · §5.3 validation → 0 · §5.5 route-auth review · §5.1 auth 5→2      | Burns four ratchets hard; feeds P1.1                     |
| **Then**     | §7.1 P1.1 → 0 · §7.2–7.3 public split + `verify_jwt=true`                                                           | The keystone's final flip; needs §5.5's inventory        |
| **Parallel** | §4.1 boundaries → 0 · §4.3/§5.2 god-file splits · §4.6 contracts · §6 repositories → Postgres · §8.2 contract tests | Long-running strangler tracks; touch-it-you-fix-it       |
| **Later**    | §7.4 esign function split · §7.5 metrics · §8.3 e2e growth · budget steps 800→600                                   | Need the earlier structure; do from data, not assumption |

**New feature work continues throughout** — WS0 is the only stop-the-line
block. Everything else rides touch-it-you-fix-it plus dedicated slices.

---

## 10a. Running the Deno gate locally (do this — it is not optional)

`npm run typecheck:deno` is the one CI gate the SPA `tsc` run cannot stand in
for: `tsconfig.typecheck.json` **excludes the edge source**, so an edge-only
type error passes every other local gate and fails only in CI. WS0 shipped one
that way — replacing an `if (email && ...)` guard with a boolean helper dropped
the type narrowing the guard had been providing, and nothing local noticed.

The ledger says this check is "not verifiable in restricted sandboxes". That is
half right, and the useful half is the other one:

```bash
# deno.land is blocked, but the same binary ships on npm
npm i --no-save --prefix /tmp/denoenv deno@2.8.1     # match CI's pin exactly
NO_COLOR=1 /tmp/denoenv/node_modules/.bin/deno check \
  --config src/supabase/functions/server/deno.json \
  src/supabase/functions/server/index.tsx 2>&1 | tee /tmp/deno.log

# The sandbox blocks jsr.io, so supabase-js types do not resolve and ~34
# SPURIOUS TS7006 implicit-any errors appear on its callback parameters.
# Filter them out and the remainder is real:
grep -E '^TS' /tmp/deno.log | grep -v TS7006     # must print NOTHING
```

**The usable signal is "zero non-TS7006 errors", not "exit 0".** That
distinction is what makes the gate runnable here at all — it caught the WS0
regression on the first try once the filter was applied, and it reproduced the
CI failure exactly (34 artifacts + 1 real error). Treat a non-TS7006 error as a
CI failure you have already been told about.

---

## 11. Working rules (how this stays landed)

1. **One reviewable slice per PR**, verified locally per `AGENTS.md` (format,
   lint, typechecks, depcruise, tests with coverage, build) before commit;
   auto-merge armed, never "waiting on CI".
2. **Every slice moves a ratchet or holds one.** If a PR fixes debt, lower the
   corresponding baseline **in the same PR** — the notice now prints when
   there's slack; act on it. A refactor that doesn't move a number should say
   which number it protects.
3. **Pure move first, behaviour later.** Splits and migrations change no
   response shapes; characterization tests pin behaviour before the move.
4. **Schemas from code, not imagination** (A19). Derive validation from the
   handler's actual reads; derive contracts from the actual wire shape.
5. **Re-verify before acting.** Four remediation items were stale when picked
   up; check the finding against source, and check `git log` for the file,
   before starting.
6. **Capabilities get wired the day they're written.** The five instances of
   written-but-unconnected safety code are the house failure mode. A mechanism
   PR is not done until something calls it and a test fails when it's removed.
7. **Update the ledger** (`docs/PRODUCTION-READINESS.md`) when state changes;
   append incidents to its Section 6. Mark items done **here** with date +
   commit, the way the remediation plan does.

---

## 12. Definition of "top-quality production grade" — exit criteria

The enhancement plan §11 checklist remains the target state. In ratchet terms,
this roadmap is complete when:

- [ ] WS0 punch list empty; no open finding in the remediation plan's CRITICAL/HIGH sections.
- [ ] `verify_jwt = true` in production; public surface served by its own function.
- [ ] `quality/baselines/anon-key-bearer-baseline`, `quality/baselines/route-validation-baseline`,
      `quality/baselines/depcruise-baseline`, `.kv-direct-import-baseline` all **0**, with
      depcruise rules and `max-lines` promoted to `error`.
- [ ] `quality/baselines/auth-implementations-baseline` = 2; `quality/baselines/raw-fetch-baseline` ≤ ~10, each
      survivor individually justified in code.
- [ ] File-size budget at 600 with zero warnings; no file in `src/` over
      1,000 raw lines.
- [ ] `clients` and `applications` served from Postgres tables with RLS and
      migrations; no unbounded `getByPrefix` on any request path.
- [ ] Backend coverage ≥ 40% statements and floored there; every route family
      has a contract test; a blocking post-deploy smoke guards every edge deploy.
- [ ] Three seeded e2e journeys required in CI.
- [ ] `imageBytes` < 50 MB; entry gzip budget stepped down and held.
- [ ] Metrics answer error-rate and latency per route family; request IDs
      already thread through logs (done).
- [ ] The ledger's Section 2 rubric has no unchecked boxes left that map to
      engineering work (operational items — backups, DR drills, POPIA/FAIS
      process — tracked separately by the operator).

---

_Prepared 2026-08-22 against `main` @ `255f708`. Every number in §1 was
measured from the working tree on that date, not carried forward. This
document plans work; it changes no application code._
