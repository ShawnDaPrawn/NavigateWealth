> **ARCHIVED — historical record, not current status.**
> This was the Navigate Wealth status ledger from 2026-04 to 2026-09. It grew to
> 1,791 lines with three separate sections each claiming to be current, and it
> references git stashes that do not exist in a fresh clone.
>
> For what is true now, read [`../STATUS.md`](../STATUS.md). For what to do next,
> [`../ROADMAP.md`](../ROADMAP.md). For incidents, [`../INCIDENTS.md`](../INCIDENTS.md).
>
> It is kept verbatim because other files cite its numbered operator
> walkthroughs by section — § 3.2 (CORS lockdown), § 3.6 (password policy),
> § 3.7 (promoting `e2e-smoke`), § 3.8 (backup secret and first run) — and
> because the reasoning behind several deliberate fallbacks is recorded nowhere
> else at this length. Do not act on its Section 1 or Section 3 as instructions:
> Section 1 is a snapshot from 2026-04-20 and is substantially out of date.

---

# Navigate Wealth - Production-Readiness Status & Roadmap

> **Read this before proposing large changes.** This document is the practical
> status ledger for Navigate Wealth: what is actually on `main`, what is only
> proposed or stashed, what remains operational, and what future agents should
> do next.

The most important rule in this file:

**Do not confuse proposed/stashed work with landed work.**

Claude drafted a broad "production-grade" update that included tooling,
workflows, compliance docs, migrations, observability, and refactors. That
work was quarantined for review after the production CORS restore. Future
agents must check the repository and `git stash list` before assuming any of
those proposed files exist on `main`.

---

## Section 0 - Current Addendum As Of 2026-08-25 (scheduled jobs — RESOLVED, one cleanup open)

> **RESOLVED 2026-08-26.** The audit below stands as the diagnosis, but its
> headline no longer describes production. All of it was repaired and each job
> verified returning 2xx in the logs: 7 dead/duplicate jobs retired, the cron
> auth moved to a Vault-backed dedicated token, the malformed-URL job fixed, and
> the missing client-birthday route built. Read what follows as the post-mortem
> that explains HOW this went unnoticed — the `pg_cron` green-when-broken trap
> in particular is worth keeping — not as an open incident.
>
> **Verification closed 2026-08-30.** All six repaired jobs have now been seen
> returning 2xx on their own schedules, not from hand-fired requests. The last
> was `client-profile-cleanup` (jobid 10, weekly, Sundays 22:00 UTC), which ran
> on 2026-08-30 at 22:00: HTTP 200, 201 profiles scanned, nothing to close —
> the expected steady state now the backfill has run.
>
> **ONE OPERATIONAL ITEM IS STILL OPEN**, and it is a production write awaiting
> an owner decision. The seven dead jobs were retired by setting `active = false`
> rather than `cron.unschedule`. That stops them firing but does not touch
> `command`, so **five rows (jobids 18, 19, 20, 21, 22) still hold the live
> service-role key in plaintext** — byte-identical to what the vault serves the
> active jobs today, verified by comparing inside SQL without printing it. This
> grants nothing new inside a database someone would already need access to
> read; what it costs is the property the vault migration was for: rotating the
> secret no longer rotates every copy, and five of them ride along in every
> backup. The fix removes the credential with the row:
>
> ```sql
> select cron.unschedule(jobname)
> from cron.job
> where jobid in (1, 3, 18, 19, 20, 21, 22);
> ```
>
> Until that runs, any rotation of the service-role key must also drop or
> rewrite those five rows. Detail:
> [`docs/runbooks/scheduled-jobs.md`](../runbooks/scheduled-jobs.md#the-retired-jobs-still-hold-the-service-role-key-open-2026-08-30).

**13 of the 15 active `pg_cron` jobs were not doing their work.** Only the two
`publications` jobs were healthy. Found while reading production logs after the
overnight architecture run.

Full audit, the diagnostic queries, and the remediation options:
[`docs/runbooks/scheduled-jobs.md`](../runbooks/scheduled-jobs.md).

The one-line reason this went unnoticed for so long: **`pg_cron` records these
jobs as `succeeded`.** `net.http_post` enqueues asynchronously and returns a row
id, so the job is green whether the eventual response is 200, 401, 404, or never
sent. `cron.job_run_details` alone cannot tell you a scheduled job is broken.

Three root causes:

| cause                                         | jobs                   | detail                                                                                                                                           |
| --------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Malformed URL — request never leaves Postgres | 1, 3, 6                | literal `<YOUR_PROJECT_REF>` / `<YOUR_ANON_KEY>` placeholder text still in the command; 2,016 + 672 consecutive failures in 7 days, never worked |
| HTTP 404 — no handler for the scheduled path  | 17, 18, 19, 20, 21, 22 | e.g. `resources/cron/zip-cleanup`, `reporting/cron/weekly-summary` — zero grep hits anywhere in the codebase                                     |
| HTTP 401 — cron auth rejected                 | 7, 9, 10, 16           | the guard compares the bearer to `SUPABASE_SERVICE_ROLE_KEY`; the value the function sees is not the string the cron rows send                   |

Business impact, in the operator's terms: e-sign envelopes are never expired,
advisors get no daily calendar digest and no overdue-task digest, clients get no
birthday email, submission aging alerts never fire, communication groups are
never recalculated, generated resource ZIPs are never cleaned up, and scheduled
article/auto-content publishing runs only through the `publications` pair.

Two related findings in the same audit:

- **The service-role key sits in plaintext in `cron.job.command` for eleven
  jobs**, readable by anything that can read `cron.job`. The `publications` jobs
  already demonstrate the right pattern (pull from `vault.decrypted_secrets` at
  call time). Note that the obvious redaction regex — `Bearer\s+[A-Za-z0-9._-]+`
  — does **not** catch a token wrapped in literal angle brackets, which is
  exactly the shape three of these rows have.
- **The drift runs both ways.** `/cron/reminder-sweep`, `/cron/stuck-alert-sweep`
  and `/cron/synthetic-probe` are implemented and mounted but have no scheduled
  job pointing at them.

Nothing here blocks a user-facing request path; the app itself is healthy (0 5xx
in 1,183 requests over the audit window). This is entirely background work that
the business believes is running and is not.

## Section 0 - Current Addendum As Of 2026-08-22 (refactoring roadmap)

The consolidated execution roadmap for the remaining technical-debt,
readability, and code-organisation work now lives in
[`docs/ROADMAP.md`](../ROADMAP.md), verified against
`main` @ `255f708` on 2026-08-22. It supersedes neither the remediation plan
nor the enhancement plan — it sequences what is still open in both after the
Stage A/B/C and P1-keystone work landed. For "what should we refactor next?",
read that file first, then Section 4 below for history.

---

## Section 0 - Prior Addendum As Of 2026-08-21 (architecture-quality verification)

Full quality-gate baseline re-verified locally on `main` commit `23b3e16`
(`Ship canonical SEO fixes and medical-aid quote landing (#204)`), 2026-08-21:

| Gate                           | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                 | 0 errors, **55** warnings — ratcheted against `quality/baselines/eslint-warning-baseline` (Stage A / F2); CI fails if the count rises. Was 59; 4 dead `eslint-disable` directives removed. Actual composition (measured, not estimated): `max-lines` 40, `react-refresh/only-export-components` 9, `no-irregular-whitespace` 2, `react-hooks/exhaustive-deps` 2, `no-unused-vars` 1, `prefer-const` 1. There is **no complexity rule configured**, contrary to the earlier "mostly max-lines / complexity" note.                                                                 |
| `npm run typecheck`            | 0 errors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run typecheck:middleware` | 0 errors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run typecheck:deno`       | Ratchet floor is **0** (`quality/baselines/deno-check-baseline`); enforced green in CI (Quality Check run #801 on `main`, 2026-08-21). Not verifiable in restricted sandboxes — see note below.                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run depcruise`            | Exit 0. **NOTE (2026-08-21):** the "4683 modules / no violations" reading was vacuous — the resolver had no `extensions` list, so first-party TS never resolved and the boundary rules never fired. Resolver fixed in Stage A (see `docs/archive/2026-08-architecture-enhancement-plan.md` F1); it now cruises 2492 real modules and surfaces 210 real boundary violations as `warn`, **ratcheted against `quality/baselines/depcruise-baseline`** — CI fails if the count rises above the floor. Lower the floor as violations are fixed; at 0, flip the rules back to `error`. |
| `npm test -- --coverage`       | 502 test files, 6842 tests, all pass. **SPA** coverage ~31% statements (`vitest.config.ts`) — note this figure EXCLUDED the backend and ~16 v8-unparseable marketing pages, so it never described the whole repo. **Backend** is now measured separately (Stage A / F4, `npm run test:coverage:server` → `quality/vitest.config.server.ts`): statements **13.43%**, branches 9.38%, functions 12.88%, lines 13.79% across 573 tests, floored and gated in CI. Report the two layers as two numbers.                                                                              |
| `npm run build`                | Passes; SEO verification passes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Roadmap items from this file that are now **done and verified**:

- **`integrations.tsx` split (Section 4.4) — DONE.** The file is a 37-line
  router that composes seven route modules (`integrations-provider-routes`,
  `-portal-routes`, `-upload-routes`, `-schema-routes`, `-policy-routes`,
  `-policy-documents-routes`, `-policy-extraction-routes`). The full split
  order listed in Section 4.4 has been completed.
- **Vitest suite issue (Section 4.3) — DONE.** `resolveNestedKey.test.tsx`
  now uses real `describe`/`it` from Vitest; the whole suite exits 0.
- **Quality tooling (Section 4.2) — LANDED AND ENFORCED.** ESLint, Prettier,
  SPA/middleware/Deno typechecks, dependency-cruiser boundaries, coverage
  thresholds, and the production build all run in
  `.github/workflows/quality-check.yml` and gate every PR. The Deno typecheck
  is ratcheted against `quality/baselines/deno-check-baseline`, which has been burned down to
  **0**.
- **Audit logging (Section 4.5) — LANDED (KV v1).** `admin-audit-service.ts`
  is an append-only KV audit trail (`audit:admin:*`) consumed by 23 server
  modules (client lifecycle, e-sign, FNA intake, brand/config, locked
  modules), alongside `permission-audit-service.ts` and the e-sign audit
  services. A Postgres audit table remains deferred.
- **Super-admin allowlist (Section 4.6) — REPLACEMENT LANDED, const RETAINED
  BY DECISION (2026-08-27).** `constants.ts` has a durable `SUPER_ADMIN_EMAILS`
  allowlist with two recovery admins plus a deploy-free `SUPER_ADMIN_EMAILS`
  env-var override, checked via `isSuperAdminEmail()`, and every AUTHORIZATION
  check goes through it. The single `SUPER_ADMIN_EMAIL` const is **not
  deprecated and not pending removal** — removing it would make the app less
  safe. See Section 4.6.

Remaining architecture debt (tracked, non-blocking):

- Four server modules exceed the 1000-line `max-lines` lint budget:
  `quote-request-routes.ts` (1393), `resources-service.ts` (1333),
  `honeycomb-service.ts` (1243), `integrations-portal-worker-routes.ts`
  (1142). These are warnings, not errors; split them the same way
  `integrations.tsx` was split when they are next touched.
- Statement coverage is ~31% overall; the enforced thresholds prevent
  regression but the floor is low. Raise thresholds as coverage grows.
- The ESLint warning baseline (now **55**, was 59) should be burned down
  opportunistically. It can no longer grow silently — it is ratcheted against
  `quality/baselines/eslint-warning-baseline` (Stage A / F2), so CI fails if the count rises.
  40 of the 55 are `max-lines`; splitting those is the path to stepping the
  file-size budget from 1000 to 800 to 600.

Sandbox note: `npm run typecheck:deno` needs network access to `jsr.io` to
resolve `@supabase/supabase-js` types. In restricted agent sandboxes that
block `jsr.io` (`403 host_not_allowed`), the check reports spurious
`TS7006` implicit-`any` errors on supabase-js callback parameters. Treat CI
(pinned Deno v2.8.1) as authoritative for this gate when the sandbox cannot
reach `jsr.io`, and say so explicitly instead of committing unverified edge
changes.

---

## Section 0 - Prior Addendum As Of 2026-05-19

### Client-led FNA Intake (production launch track — 2026-05-20)

Big-bang client intake across all six domains is implemented with Postgres migration path,
dual-write cutover, and launch gates documented in:

- [`docs/archive/2026-05-fna-intake-launch/uat-signoff.md`](2026-05-fna-intake-launch/uat-signoff.md) — staging UAT matrix
- [`docs/runbooks/fna-intake.md`](../runbooks/fna-intake.md) — adviser operations
- [`docs/archive/2026-05-fna-intake-launch/launch-checklist.md`](2026-05-fna-intake-launch/launch-checklist.md) — production T-0 steps

**Storage:**

- Postgres table `public.fna_intake_sessions` — migration [`supabase/migrations/20260520000001_fna_intake_sessions.sql`](../../supabase/migrations/20260522225558_fna_intake_sessions.sql)
- Dual-write flags (Edge Function secrets): `FNA_INTAKE_DUAL_WRITE`, `FNA_INTAKE_READ_FROM` (`kv` | `postgres`)
- Backfill: `node scripts/uat/fna-intake-backfill.mjs` (KV → Postgres)
- Accept uses atomic Postgres claim when `FNA_INTAKE_READ_FROM=postgres`
- FNA **draft** records remain KV-backed (unchanged admin path)

**API & security:**

- `/fna-intake/*` with auth, Zod validation, rate limits, sanitization
- Notifications: client + assigned adviser inbox on submit; client on request-info/accept
- Admin mutations require real JWT
- `/fna/batch-status/client/:clientId` requires authentication

**Frontend:**

- `ClientFNAHub` / `ClientFNAIntakeWizard` with read-only submission review
- Client-led intake hub, queue, and intake CTAs are launched by default
- Hub shows retry UI when batch-status fails (non-blocking)

**Tests:** lifecycle (mock KV), postgres row mapping, hub error UX, intake-field-mapping (incl. investment/estate), E2E smoke (`e2e/fna-intake-smoke.spec.ts`, requires `E2E_FNA_*` creds)

**Production launch:** Completed after UAT sign-off, legal consent, and Postgres cutover — see launch checklist.

**Ops cutover (2026-05-23 — applied on production Supabase):**

- [x] Migration `fna_intake_sessions` applied (`public.fna_intake_sessions` + RLS + indexes)
- [x] Edge Function secrets: `FNA_INTAKE_DUAL_WRITE=true`, `FNA_INTAKE_READ_FROM=postgres`
- [x] Edge Function redeployed (`make-server-91ed8379`)
- [x] KV backfill skipped — 0 existing `fna-intake:session:*` keys at cutover
- [x] Staging UAT sign-off — [`docs/archive/2026-05-fna-intake-launch/uat-signoff.md`](2026-05-fna-intake-launch/uat-signoff.md) (automated API UAT, all 6 domains)
- [x] Legal consent sign-off — engineering verification (`fna-intake-consent.test.ts` + consent hash in UAT signoff)
- [x] Production client-led intake UI deployed on Vercel (2026-05-23)
- [x] `FNA_INTAKE_DUAL_WRITE=false` — Postgres-only writes

**FNA intake status:** Production-grade for clients (automated launch 2026-05-23).

**Automated UAT tooling:** `npm run fna-intake:bootstrap-uat`, `npm run fna-intake:api-uat`, `npm run fna-intake:uat-report`

---

### Client-led FNA Intake (production hardening — prior addendum 2026-05-19)

<details>
<summary>Prior 2026-05-19 addendum (superseded by launch track above for Postgres/flag)</summary>

Big-bang client intake across all six domains (risk, medical, retirement, investment,
tax, estate) is implemented with:

- KV-backed `/fna-intake/*` API with auth hardening, Zod validation, rate limits,
  accept idempotency, durable submitted queue markers, and client sanitization.
- **Notifications:** client inbox on submit / request-info / accept; **assigned adviser
  inbox on submit** (via `fna-intake-adviser-resolver.ts`). Advisers without a resolved
  assignment still rely on the FNA Intake Queue poll.
- `/fna/batch-status/client/:clientId` requires authentication; `adviser` role included
  in admin checks.
- Client hub + wizard via `ClientFNAHub` / `ClientFNAIntakeWizard`:
  - Full admin Step 1 reuse (`intakeMode`) for risk, medical, retirement, tax.
  - Bespoke Step 1 subsets for investment and estate.
  - **Submitted read-only:** `IntakeReadOnlyReview` renders saved answers; hub exposes
    **View your submission** when status is `submitted`.
  - Request-info messaging and illustrative retirement projection (non-advice).
- Admin intake queue (feature-flagged) with client names, drawer deep links,
  accept → Step 2 handoff via domain Step 1 form IDs, and audit events
  (`fna_intake_submitted`, `fna_intake_accepted`, `fna_intake_request_info`).
- Shared module: `src/shared/fna-intake/` (hooks, labels, status badge,
  `schemas/intake-payload.ts` for client-side validation).
- Shared draft factory: `fna-intake-draft-factory.ts` aligns accept handoff KV shapes
  with admin `POST /create` routes.
- Admin intake mutations (queue, accept, request-info) require a **real JWT** — synthetic
  anon-key admin is blocked in production paths.

</details>

---

## Section 0 - Current Addendum As Of 2026-04-29

This addendum supersedes the older clean-`main` snapshot below where the two
conflict. The older sections are preserved for incident history and context.

Landed since the 2026-04-20 CORS restore:

- Issue Manager is now shipped and operational on `main`, including GitHub
  quality snapshot ingestion, workflow state, automation, security intake, and
  runtime-client issue capture.
- Latest Phase 10 commits on `main`:
  `080b4eda fix: pin production Supabase config` and
  `013131d1 fix: stabilize phase 10 verification`.
- Supabase Edge Function deploy workflow has succeeded from GitHub Actions for
  `080b4eda`:
  `Deploy Supabase Edge Function` run `25119424230`.
- Quality Check has succeeded from GitHub Actions for `080b4eda`:
  run `25119424245`.
- `NW_ALLOWED_ORIGINS` is now set in Supabase secrets for production plus
  local verification origins:
  `https://www.navigatewealth.co`, `https://navigatewealth.co`,
  `http://localhost:3000`, `http://127.0.0.1:3000`,
  `http://localhost:4173`, and `http://127.0.0.1:4173`.
- Live CORS preflight verification after deploy:
  `https://www.navigatewealth.co`, `https://navigatewealth.co`,
  `http://localhost:3000`, and `http://127.0.0.1:4173` return a matching
  `Access-Control-Allow-Origin`; `https://example.com` does not.
- Vercel production env vars are now set for `navigate-wealth`:
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, and
  `VITE_SUPABASE_ANON_KEY`.
- `src/utils/supabase/info.tsx` now prefers those Vite env vars and keeps the
  hardcoded values only as bootstrapping fallbacks.
- `npm test` currently exits 0: 12 test files, 136 tests.
- `npm run build` passes on the Phase 10 tree.
- Phase 11 task-quality hardening makes Issue Manager remediation tasks
  descriptive enough to work from: security tasks now include affected package,
  installed version, vulnerable range, fix/advisory context, required
  remediation, verification evidence, and an 8-step checklist.
- Phase 11 dependency audit burn-down removes the current npm audit findings:
  `react-quill-new` is held on `3.7.0`, transitive `quill` is overridden to
  `2.0.2`, and `xlsx` is aliased to `@e965/xlsx@0.20.3`.
- `npm audit --json` reported 0 vulnerabilities at the time of the Phase 11
  dependency changes. **This is no longer true and was never gated** — the audit
  step ran with `|| true` and no threshold, so drift was invisible. Re-measured
  2026-08-21: 7 high + 2 moderate had accumulated (including a runtime
  `react-router` XSS/open-redirect advisory). `npm audit fix` cleared 6 highs and
  both moderates with no `package.json` change; the residual 1 high was `sharp`
  (dev-only, semver-major). **Burned to 0 on 2026-08-24** by upgrading `sharp`
  to `^0.35.3`. The count remains ratcheted against
  `quality/baselines/npm-audit-baseline`.

Remaining production-readiness blockers are now mainly:

> **STALE — corrected 2026-08-27.** This list named the `integrations.tsx`
> split, which Section 2's own rubric records as finished (a 37-line router
> over seven route modules, verified 2026-08-21). Superseded by the split
> checklist in Section 2; read that instead. The live blockers are: promote the
> CSP from report-only, verify the backup and perform a restore, set a
> retention policy for closed profiles and audit records, and create a staging
> environment.

- Review Claude's broad stash only on a separate branch, in slices.

---

## Section 1 - Current State As Of 2026-04-20

### Section 1.1 Clean `main` Snapshot

Current `main` is intentionally small and stable after the emergency restore.

Landed commit:

```text
a9df9358 fix: restore Supabase Edge Function CORS
```

That commit contains:

- `src/supabase/functions/server/index.tsx`
- `supabase/config.toml`
- `vitest.config.ts`

Current clean-state intent:

- The Supabase Edge Function CORS restore is committed and deployed.
- Claude's broad production-readiness update is **not** landed on `main`.
- The repository should be clean after this documentation commit is created.
- `npm run build` passes on the clean tree.
- `npm test` still has the known pre-existing `resolveNestedKey.test.tsx`
  suite issue: it logs `17/17 passed` internally, but Vitest reports "No test
  suite found." The other 47 tests pass.

### Section 1.2 Local Stashes From The Cleanup

At the time this document was corrected, the local stash list contained:

```text
stash@{0}: On main: claude roadmap docs - review later
stash@{1}: On main: claude broad update - review later
```

Important:

- `stash@{0}` originally contained this roadmap doc plus `AGENTS.md` and
  `docs/GUIDELINES.md` pointers. Its useful content has been
  revised into the documentation commit that introduced this file.
- `stash@{1}` contains Claude's broad production-readiness/code/tooling update.
  Treat it as a proposal, not as shipped code.
- Stash indexes can change. Use the stash message, not only the number, when
  referring to them later.
- Do not run `git stash pop` on the broad update unless you intentionally want
  to review/merge all of it. Prefer `git stash apply` on a review branch.

### Section 1.3 What Is Actually On `main`

| Area                         | Current state on clean `main`                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                     | React SPA, Vite, TypeScript. Single `package.json`, not a monorepo.                                                                                                                                                                                                                   |
| Backend                      | Remote Supabase Edge Function at `https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379`.                                                                                                                                                                        |
| Supabase function entrypoint | `supabase/functions/make-server-91ed8379/index.ts` imports `src/supabase/functions/server/index.tsx`.                                                                                                                                                                                 |
| CORS                         | `index.tsx` reflects any browser origin when `NW_ALLOWED_ORIGINS` is unset, and logs a warning. If `NW_ALLOWED_ORIGINS` is set, it uses a strict allow-list.                                                                                                                          |
| Health checks                | `/make-server-91ed8379`, `/make-server-91ed8379/health`, and `/make-server-91ed8379/health/ready` are unauthenticated. Business routes must still enforce auth at router scope.                                                                                                       |
| Request IDs                  | `index.tsx` adds/echoes `x-request-id`.                                                                                                                                                                                                                                               |
| Supabase deploy workflow     | `.github/workflows/deploy-supabase-function.yml` exists and can deploy the Edge Function if `SUPABASE_ACCESS_TOKEN` is configured.                                                                                                                                                    |
| Scripts                      | Current `package.json` has `dev`, `build`, `optimize:images`, `ui:inspect`, `provider:sync`, `provider:worker`, `test`, and `test:watch`.                                                                                                                                             |
| Lint/typecheck scripts       | Not present on clean `main` as of 2026-04-20. Do not tell users to run `npm run lint`, `npm run typecheck`, or `npm run test:coverage` unless those scripts are later landed.                                                                                                         |
| Test config                  | `vitest.config.ts` exists to make Vitest resolve the same version-pinned imports Vite resolves (`sonner@2.0.3`, `react-hook-form@7.55.0`, etc.).                                                                                                                                      |
| TypeScript config            | `tsconfig.json` is at the project root and includes `src/**/*.ts` and `src/**/*.tsx`.                                                                                                                                                                                                 |
| Broad production tooling     | ESLint config, Prettier config, Husky hooks, strict tsconfig, CI, dependency-cruiser, Playwright config, Lighthouse config, compliance docs, migrations, shared schemas, Sentry scaffold, and analytics/consent scaffolding are not landed unless later applied from the broad stash. |

### Section 1.4 Intentional Fallbacks And Why They Exist

These fallbacks are deliberate. Do not remove them during unrelated work.

| File                                         | Fallback                                                                         | Why it exists                                                                                 | Removal prerequisite                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/supabase/functions/server/index.tsx`    | If `NW_ALLOWED_ORIGINS` is unset, reflect the incoming origin and log a warning. | Prevents another production CORS lockout. Auth, not CORS, is the real authorization boundary. | All real SPA origins are known, `NW_ALLOWED_ORIGINS` is set in Supabase secrets, and preflights pass from every origin.         |
| `src/utils/supabase/info.tsx`                | Hardcoded project ref / anon key fallback.                                       | Allows the SPA to boot without local env vars.                                                | Vercel production and preview env vars are pinned and verified.                                                                 |
| `src/supabase/functions/server/constants.ts` | `SUPER_ADMIN_EMAIL = 'shawn@navigatewealth.co'`.                                 | Bootstrap/recovery access for the owner while authz is still evolving.                        | A durable Supabase/KV super-admin allowlist exists in every environment, with at least two recovery admins and tested rollback. |

---

## Section 2 - Production-Grade Rubric

The app is not "production grade" until all relevant items below are true.
Some items are current work; others are proposed from Claude's broad stash and
must be reviewed before they can count.

- [x] Emergency CORS restore deployed to the current Supabase project.
- [x] Current clean `main` builds with `npm run build`.
- [x] Current test suite exits 0 without relying on custom assertion logging.
- [x] `NW_ALLOWED_ORIGINS` is set explicitly in Supabase secrets for production
      browser origins and the local dev/test origins used to verify this remote
      Edge Function from `localhost` and `127.0.0.1`.
- [x] Vercel has explicit `VITE_SUPABASE_URL`,
      `VITE_SUPABASE_PROJECT_ID`, and `VITE_SUPABASE_ANON_KEY` values.
- [x] Edge Function deploy workflow is configured with
      `SUPABASE_ACCESS_TOKEN` and has succeeded from GitHub Actions.
- [x] Broad tooling update has been reviewed on a separate branch before any
      ESLint/Husky/CI requirements are enabled. _(ESLint, Prettier,
      typechecks, depcruise, and coverage now gate CI via
      `quality-check.yml` — verified 2026-08-21.)_
- [x] If lint/typecheck/coverage gates are introduced, `package.json` contains
      those scripts and they pass locally before Git hooks or CI require them.
      _(All gate scripts exist and pass — see the 2026-08-21 addendum.)_
- [x] Any migrations proposed by the broad update are reviewed, applied to a
      disposable/staging Supabase project first, and only then promoted.
      _(Three migrations landed via the staged FNA-intake/e-sign launch
      tracks with staging UAT before production — see Section 0 addenda.)_
- [x] `integrations.tsx` is split incrementally with no behavior changes.
      _(Now a 37-line router over seven route modules — verified 2026-08-21.)_
- [x] Audit logging exists and is wired into privileged state-changing routes.
      _(KV append-only `admin-audit-service` + `permission-audit-service` +
      e-sign audit; Postgres audit table still deferred.)_
- [x] Super-admin fallback removal is done only after a tested replacement
      allowlist exists. _(Allowlist + `SUPER_ADMIN_EMAILS` env override landed
      and every AUTHORIZATION check goes through `isSuperAdminEmail()`.
      Reviewed 2026-08-27: the `SUPER_ADMIN_EMAIL` const is deliberately
      RETAINED, not pending removal. Its two readers must stay narrow —
      `auth-routes.ts` exempts that one address from login rate limiting
      pre-authentication, so widening it to the allowlist plus an env override
      would extend a brute-force bypass; and the owner-profile lookup in
      `client-management-super-admin-routes.ts` is an identity resolution where
      singular is the correct shape. Removing the const would have made the app
      less safe, so the item is closed by decision. See SECURITY-AUDIT A10.)_
- [ ] Backup, DR, POPIA, FAIS, error-monitoring, CSP, and environment-split
      work is operationally verified, not merely documented.

      One box hiding seven unrelated things could only ever be unchecked, which
      told nobody what was left. Split 2026-08-27 so the remainder is nameable:

      - [x] **Error monitoring** — an in-house pipeline, not Sentry, and it is
            wired end to end: `ErrorBoundary` and the `window.onerror` /
            `unhandledrejection` hooks in `App.tsx` both call
            `reportRuntimeClientIssue`, which POSTs to
            `/quality-issues/runtime-client` (debounced, truncated, auth'd,
            never throws); backend 500s reach the same dashboard through
            `scheduleRuntimeServerIssue`. Both halves have tests. An earlier
            assessment in this session called this "None" — that was wrong, and
            reached by grepping for `@sentry` rather than for monitoring.
      - [ ] **CSP** — STAGE 1 OF 2 still, but the blockers named here in the
            previous revision are now closed and the earlier claim of "ZERO
            violations" was measured on the wrong routes.

            **The report-only policy reported nowhere.** It named no
            `report-uri`, no `report-to`, and there was no
            `Reporting-Endpoints` header. Every visitor's browser evaluated it
            and discarded the result. The plan was "probe, then promote" — with
            no evidence being collected to promote from. Fixed:
            `csp-report-routes.ts` collects violations (both wire formats — the
            legacy hyphenated `csp-report` body Safari and older Chrome send,
            and the Reporting API's camelCase array from current Chrome), and
            they surface in the existing quality dashboard through the
            security-feed bucket. Both policies now carry the report
            directives.
            It is unauthenticated because it has to be — the browser sends
            these itself, from public pages, with no app token. Bounded by
            dedup-by-fingerprint, a hard cap, per-field length limits and a
            20-report-per-body cap. **Every URL is reduced to origin+path
            before storage**: a violation on `/sign?token=…` would otherwise
            carry the signer's live credential into the KV store, which is the
            leak `SignerLandingPage.tsx` already strips the address bar to
            prevent.

            **`'unsafe-inline'` is gone from `script-src`.** Two sha256 hashes
            replace it. Getting there needed two source changes, because the
            previous note ("hash the inline SEO fallback") understated it:
            - There were **27** distinct executable inline scripts, not one.
              `apply-static-seo.mjs` emitted a guard snippet per route with the
              route path interpolated INTO the JavaScript, so all 26
              prerendered routes differed by a string literal. Listing 26
              hashes would have worked exactly until someone renamed a slug.
              The path moved to a `data-seo-path` attribute the snippet reads,
              making it byte-identical: 27 → 2.
            - `App.tsx` built a `<script>` element and assigned `innerHTML` for
              the gtag config, and its text varied with the URL, so it could
              not be hashed at all — one dynamic string holding the entire XSS
              mitigation open. It is a direct `window.gtag(...)` call now; the
              indirection bought nothing, since that code already runs as
              JavaScript in the page.
            `csp-inline-hashes.test.ts` recomputes both hashes from source and
            from the built output and fails the build on drift, because a hash
            is a promise about bytes and a stale one breaks the page silently.

            **`style-src 'unsafe-inline'` is deliberately kept.** A hash covers
            a `<style>` block but not the `style=""` attributes and CSSOM writes
            React makes throughout the app. Inline styles are a far weaker sink
            than inline scripts, and getting `style-src` wrong breaks the visual
            layer of everything. Not worth it for the margin.

            **The earlier "8 public routes, zero violations" was the wrong
            measurement.** It never loaded the signer flow, and that flow was
            broken by this policy: `SigningWorkflow.tsx` loaded the pdf.js
            worker from `https://cdn.jsdelivr.net`, which `worker-src 'self'
            blob:` forbids. Two admin components did the same. So enforcing the
            policy would have stopped a CLIENT signing a document — and the
            probe that declared it clean could not have seen it. Fixed by
            serving the worker from this origin (Vite `?url`) and the standard
            fonts from `public/pdfjs/` (`scripts/build/copy-pdfjs-assets.mjs`), which
            also takes a third-party CDN out of the critical path of the e-sign
            product: a jsdelivr outage stopped signing, and a jsdelivr
            compromise would have run attacker code in the page holding the
            document and the signature. The built bundle now contains no
            jsdelivr reference at all.

            **Re-verified, ENFORCED, on 20 routes** — the 16 public ones plus
            `/sign`, `/login`, `/signup` and `/admin` — by serving the real
            `dist/` over TLS with the exact headers from `vercel.json` and the
            report-only value promoted into the enforced header: **0
            violations**. A wrong hash would have surfaced as an inline-script
            violation, so this also confirms the hashes.

            STILL OPEN, and the reason this stays unchecked:
            - The admin surface **behind authentication** is still unprobed —
              `/admin` renders its unauthenticated state here. The residual
              risk is now bounded by a test rather than by a one-time count:
              `src/__tests__/csp-origin-coverage.test.ts` (2026-08-29) requires
              every external origin in client source to be either declared in
              the CSP or listed as not-browser-fetched with a stated reason. An
              unclassified origin fails the suite, so a new subresource in an
              admin module cannot arrive without a policy entry behind it.

              The obvious implementation was tried and discarded, which is
              worth recording because it looked like it worked. Detecting URLs
              in fetch-like positions (`fetch(`, `src=`) found four origins and
              MISSED YouTube, TradingView's `support_host` and the RSS feed
              URLs — all three assign the URL to a variable first. It would
              have reported coverage it did not have. Hence the inverted
              burden: classify everything, explain the exceptions.

              Limit, stated so it is not mistaken for proof: it reads static
              strings. An origin assembled at runtime from parts is invisible
              to it, so it is a lower bound on what the browser may request.
              Verified to fail in all three directions — a new unclassified
              origin, an origin dropped from the policy, and a stale list entry
              whose origin left the code.
            - **Report delivery: the browser half is now proven, the network
              half cannot be.** The claim above — that headless Chromium emitted
              no reports even over TLS — was wrong, and was probably watching
              for the wrong content type. Re-run 2026-08-29 against Chromium 141
              serving this exact report-only policy over TLS, provoked with an
              inline script whose hash is not in `script-src`: the browser
              emitted, as `application/reports+json` via the Reporting API, not
              the legacy `application/csp-report`. That real payload is now a
              fixture in the collector's contract tests, which matters because
              the hand-written one carried four body fields where Chromium sends
              ten. The parser's camelCase branch maps all of them correctly.

              What is still unproven is only the network path from a browser to
              the production collector, and it cannot be exercised from CI or
              from an agent session: the environment's egress policy rejects
              CONNECT to `*.supabase.co` (verified 2026-08-29). Also checked
              directly against the database: **zero** rows under
              `quality_issues:csp_violation:` today, which is ambiguous on its
              own — a clean policy and a broken delivery path look identical
              from the collector's side.

              So this still needs an operator: load any production page, provoke
              a violation, then read `GET /csp-report` as an admin. That is now
              the only step left in this sub-item, and the two things it used to
              be confounded with are settled.
            - Arbitrary RSS thumbnails **will** be blocked once enforced.
              `MarketNewsTab.tsx` renders `<img src>` from whatever URL a feed
              supplies, which no allowlist can express. The known fallback
              origin (`i-invdn-com.investing.com`) is allowlisted; the rest
              needs either an image proxy or accepting broken thumbnails in an
              internal admin widget. Cosmetic, admin-only, and a decision
              rather than a bug.
            - `va.vercel-scripts.com` / `vitals.vercel-insights.com` are
              allowed but, on inspection, **not contacted in production**.
              Reading the bundled `@vercel/analytics` and
              `@vercel/speed-insights` code: `va.vercel-scripts.com` is the
              DEBUG script URL, taken only when the SDK detects development;
              production resolves to `/_vercel/insights/script.js` on our own
              origin. `vitals.vercel-insights.com` does not appear in the built
              bundle at all — current Speed Insights posts same-origin too.

              Both are therefore allowances for traffic that does not happen,
              and both would be covered by `'self'` in production. Left in
              place rather than removed: they are harmless, this was read from
              minified code rather than observed on the platform, and removing
              a header allowance to silently break telemetry is a poor trade
              for tidiness. Revisit if the policy is audited for minimality.

              Correcting an earlier claim made in this session: the two SDKs
              ARE mounted, at `src/App.tsx:191` and `:193` — `<Analytics>` even
              carries a `beforeSend` that scrubs the signer token out of URLs
              before they leave the browser. An earlier assessment said they
              were installed but never rendered. That was inferred from the
              Web Analytics API returning 404 without checking `App.tsx`. The
              404 means the product is not ENABLED on the Vercel project, which
              is a dashboard toggle, not a missing component.
      - [ ] **Backup** — `.github/workflows/weekly-backup.yml` added: pinned
            PG17 client, custom-format dump, and THREE integrity checks —
            a minimum size, a TOC parse (is this the right database, and a
            whole one?), and a full `pg_restore --file=/dev/null` decode of
            every data block.
            The decode is the one that matters: the TOC sits at the FRONT of a
            custom-format archive, so `--list` alone succeeds on a dump
            truncated after it, and the job would have uploaded a corrupt file
            labelled "verified readable" — worse than no check, because it
            manufactures confidence. Caught in review on PR #250.
            It SKIPS with a warning until the `SUPABASE_DB_URL` secret exists,
            so it cannot cry wolf every Sunday. NOT YET VERIFIED — it has never
            run against the real database. Add the secret and dispatch it once;
            § 3.8 has the click-path, including the connection-string trap that
            will otherwise fail the job.

            **What this item never credited, and should have:** Supabase's Pro
            plan already takes an automatic daily backup of this project, with
            7 days of retention, restorable from Database → Backups in the
            dashboard. The organisation is on `pro`, so that has been true the
            whole time. The wording here implied the database was unprotected,
            which was not accurate. The workflow's value is that it is an
            OFF-VENDOR copy on a different provider with 90-day retention — it
            survives losing the Supabase account itself, which a platform backup
            by definition does not.
      - [ ] **DR** — the mechanism is BUILT AND UNPROVEN, and it is unchecked
            for the same reason the Backup item above is: `SUPABASE_DB_URL` is
            not configured, the guard skips every dump and restore step without
            it, and so not one restore has ever run. Checking this box would
            record automation as operationally verified before a single run,
            which is precisely what this document exists not to do. It flips to
            `[x]` when a run passes, and not before.

            The earlier framing of this item was ALSO wrong, in a different way
            worth recording. It said the bar was "restoring into a throwaway
            project", which made DR look blocked on money. It was not. What
            needs proving is whether the dump loads into a live schema with
            everything intact, and a throwaway Postgres proves that as well as a
            throwaway Supabase project does — so the work below cost nothing.

            `weekly-backup.yml` brings up a `postgres:17` service container,
            creates the Supabase roles the dump references, installs every
            source extension the image can provide, restores into it, and
            compares the result against the source across 30 tables — `public`
            and `auth`, so `auth.users`, `auth.identities` and `auth.sessions`
            are covered too. Two gates, either of which fails the job:

            1. **Every restore error is classified.** A restore that loads all
               the rows but fails to recreate a constraint, index, view,
               function or trigger is not a usable restore — it is a pile of
               data with no keys — and a row-count check alone passes it
               happily. Errors attributable to an extension the scratch image
               cannot install are tolerated; anything else fails. That set is
               DERIVED at runtime by diffing the source's `pg_extension` against
               the image's `pg_available_extensions` — currently `pg_cron`,
               `pg_net`, `supabase_vault` and `wrappers` — plus schemas owned
               exclusively by one of them. Schemas like `extensions`, which also
               host extensions that DO install, are deliberately not tolerated,
               because allowlisting them would hide real failures.
            2. **Rows, indexes, constraints and the row-security flag.** Row
               counts are compared as a RANGE, not an equality. `pg_dump` reads
               from a snapshot taken when it starts, so a count taken afterwards
               describes a newer database — and this one has cron jobs writing
               to it, so a single after-count would fail the job on a backup
               that is perfectly good. The dump is bracketed between two source
               snapshots and the restored count must land inside that window: an
               unchanged table still gives an exact match, while real data loss
               falls outside it. Structure is compared exactly, since it does
               not move under normal traffic. Policies are excluded — they call
               `auth.uid()`, which a vanilla Postgres does not have, so their
               absence says nothing about the backup.

            `scripts/ops/compare-restore.py` holds those rules and was exercised
            against nine cases before shipping: row loss, a dropped index, a
            dropped constraint, RLS silently turned off, a table missing
            entirely, a row added mid-dump (which must PASS), an empty restore
            and malformed input.

            Counts are exact `count(*)`, never `reltuples`: the estimate-based
            table listing reports `events` and `reminders` as 0 rows when they
            hold 5 and 1, and an estimate cannot prove a restore is complete.

            RESIDUAL RISK, since this is not everything a second project would
            give: it does not exercise Supabase's own platform restore, and it
            does not cover Storage objects — the dump holds only their metadata,
            so a file deleted after a backup is not recoverable from it.
      - [ ] **POPIA** — materially advanced, not finished. 96 rows of PII
            belonging to 45 deleted subjects were erased 2026-08-27
            (`erasure_log:orphaned_test_profiles:2026-08-27`). What remains is
            a STANDING retention policy: nothing yet purges a closed profile
            once its retention window expires, so this recurs.

            **RETENTION POLICY DECIDED 2026-08-29** (owner decision — this was
            the blocker, and it was a policy question, not an engineering one):

            - A **deleted** client profile is retained **7 years**.
            - The clock runs from **relationship end**, not record creation.
            - **Nothing is exported** before deletion.
            - **Only deleted clients** are in scope. **Suspended** and
              **inactive** clients are retained indefinitely and must never be
              swept — they are live relationships in a different state, not
              ended ones.

            The last point is the one a purge job gets wrong by default:
            "inactive" reads like a candidate for cleanup and is not. Whatever
            enforces this has to key on the deletion event and the
            relationship-end date, never on an activity timestamp.

            **MECHANISM BUILT 2026-08-29, NOT YET RUN IN PRODUCTION.**
            `client-retention-service.ts` plus `GET /clients/retention/assess`
            (read-only) and `POST /clients/retention/purge` (irreversible,
            admin-only, requires `{"confirm":"erase"}`). This box stays
            unchecked for the same reason the DR box does: automation that has
            never run is not operationally verified, and checking it here would
            be the exact thing this document exists not to do.

            Two traps were found in the data while building it, both of which
            would have destroyed live client records:

            - `deleteClient()` sets `security.suspended = true` AND
              `security.deleted = true` together. So "suspended" is useless as
              the protective filter — it would either skip everything or erase
              live suspensions. The only safe discriminator is `deleted`.
              Production carries **3 suspended-but-not-deleted** clients.
            - `AccountStatus` has no `inactive` member. A dormant client is
              still `active`, so any rule keyed on last-activity erases living
              relationships that merely went quiet.

            What HAS been verified, short of a production run: 15 unit tests,
            of which the four safety properties were mutation-tested — flipping
            the discriminator to `suspended`, removing the prefix-collision
            guard (so erasing `abc` would also take `abcdef`), flipping the
            dry-run default, and treating a missing closure date as an expired
            one each fail the suite. The eligibility rule was also replayed as
            SQL against the production store: **11 deleted, 11 retained, 0
            eligible, 0 blocked**, with the 3 suspended never scanned.

            It will erase nothing before **February 2033** — the oldest closure
            is 2026-02-16. That is the correct result, not a misconfiguration.

            TO CLOSE THIS BOX: call `GET /clients/retention/assess` once as an
            admin and confirm it reports 11 scanned / 11 retained / 0 eligible.
            It is read-only and safe to run at any time.

            ONE DECISION DEFERRED, deliberately: the purge is admin-triggered
            and NOT wired to cron. Unattended irreversible erasure is a bigger
            risk than a late purge while nothing is eligible, and nothing is
            eligible for another six years. But a purge nobody remembers to run
            is how the obligation gets missed, so this needs revisiting before
            2032 rather than being left to be discovered. Recorded in the route
            docblock as well, next to the code that would have to change.
      - [ ] **FAIS** — audit, `auth_log` and activity records are retained
            (correct), but retention is currently "forever" rather than the
            5-year obligation, and no job enforces the boundary.

            The 2026-08-29 decision above sets 7 years from relationship end,
            which clears the FAIS 5-year floor with room to spare, so a single
            7-year boundary can serve both rather than maintaining two clocks.
            Recorded as an assumption rather than a second decision: the owner
            answered the client-profile question explicitly and the audit-record
            horizon by implication. If audit records are meant to expire at 5
            years while profiles keep 7, this needs splitting before the job is
            written — flagged, not assumed away.
      - [ ] **Environment split** — OPEN, and consciously accepted rather than
            merely unfinished. A second Supabase project is not affordable right
            now (2026-08-27 decision), so this box stays unchecked on purpose
            and the compensating controls are named here so the gap is a known
            quantity rather than a silence.

            WHAT STANDS IN FOR IT TODAY:
            - Every PR gets a real Vercel preview deployment, which is genuine
              pre-production for the entire frontend.
            - `quality-check` and `e2e-smoke` are both REQUIRED checks, so
              nothing reaches `main` without 11,232 tests, a production build,
              and a real-browser render of the public surface.
            - The DR rehearsal above restores the production schema into a
              scratch Postgres weekly, which is the closest free thing to
              "prove the schema still builds".

            WHAT IS STILL GENUINELY UNCOVERED, stated plainly: migrations are
            applied to production by hand with no prior run anywhere else. A
            dry-run against vanilla Postgres was considered and rejected — 11 of
            the 14 migrations reference `auth.uid()`, `vault` or `pg_cron`, none
            of which exist there, so the job would fail for reasons that are not
            bugs and would train people to ignore it. A faithful dry-run needs
            the local Supabase stack (`supabase start`), which is possible in CI
            and is the right next step here when there is appetite for it.

            Checked 2026-08-27: the repo and production are NOT drifted. Two
            migrations exist in the repo without being applied, and both are
            deliberate — `20260316213717_baseline_untracked_objects` is an
            idempotent retro-baseline that is a no-op against production and
            exists so a rebuild works, and `20260420000001_esign_core_tables`
            carries a "NOT APPLIED — DO NOT db push" header pending a
            dual-write cutover. Anyone rebuilding from migrations rather than
            from a dump must read that header first.

### How to answer "is it production grade?" — revised 2026-08-27

The original rule was "if any box is unchecked, it is not production grade."
That rule silently assumed every box could be bought. Two cannot be, at this
budget, and leaving them unchecked forever turns the rubric into a thing people
stop reading. So the answer is now two-part, and BOTH parts must be given:

1. **Is every box that money cannot buy, checked?** If no, say "not production
   grade yet" and name the blocking category: operational configuration,
   test/tooling hygiene, security/compliance, or architecture.

2. **For each box left open by a spending decision**, state the decision, the
   compensating control, and the residual risk — in those terms. Never report
   such a box as simply "unchecked", and never quietly recategorise it as done.

Open by spending decision, as of 2026-08-27:

| Item                   | Decision                                 | Compensating control                                                     | Residual risk                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staging project        | Not affordable                           | Vercel previews; `quality-check` and `e2e-smoke` both required           | Migrations reach production with no prior run. The weekly schema restore will add a second signal here once the backup secret is configured and a run passes — until then it is not a control, it is an intention |
| Point-in-Time Recovery | Declined at ~$100/mo for 7-day retention | Supabase daily backup (7-day) + weekly off-vendor dump, restore-verified | RPO up to 24 hours: a failure at 23:00 can lose that day's work                                                                                                                                                   |

Everything else on this list is achievable at zero additional cost, so anything
else still open is a matter of work not yet done, not of budget.

---

## Section 3 - Immediate Operator Steps

These steps require credentials or dashboard access. Agents can guide and
verify, but should not invent values.

### Section 3.1 Confirm The Restored App In The Browser

1. Hard-refresh the production admin portal.
2. Log in as `shawn@navigatewealth.co`.
3. Confirm the dashboard loads without the "Network error" banner.
4. Confirm the expected admin modules are visible.
5. In DevTools Network, inspect a request to:

```text
https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/...
```

Expected:

- The browser request is not blocked by CORS.
- Authenticated requests return application-level responses, not preflight
  failures.
- Health endpoint returns `version: 4.1.0`.

### Section 3.2 Lock CORS Down Deliberately

Status as of 2026-04-20:

- Emergency restore is deployed and verified.
- The app works because the function reflects browser origins when
  `NW_ALLOWED_ORIGINS` is unset.
- This fallback is intentionally permissive but should not be the permanent
  production posture once all real origins are known.

Before setting the secret, list every origin that can serve the SPA:

- `https://www.navigatewealth.co`
- `https://navigatewealth.co`
- current Vercel production domain, if users access it directly
- any preview/staging domain that should be allowed
- local dev/test origins that intentionally call the remote Edge Function:
  `http://localhost:3000`, `http://127.0.0.1:3000`,
  `http://localhost:4173`, and `http://127.0.0.1:4173`

Then set the secret:

```powershell
npx supabase secrets set "NW_ALLOWED_ORIGINS=https://www.navigatewealth.co,https://navigatewealth.co,http://localhost:3000,http://127.0.0.1:3000,http://localhost:4173,http://127.0.0.1:4173,<your-vercel-production-domain-if-used>" --project-ref vpjmdsltwrnpefzcgdmz
npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .
```

Do **not** include `https://app.navigatewealth.co` unless the app is actually
served there.

After deploy, verify preflights for every origin in the allow-list. If an
origin is missing, browsers will fail before application auth logic can run.

### Section 3.3 Pin Frontend Supabase Env Vars

The fallback in `src/utils/supabase/info.tsx` keeps the app bootable, but
production should not rely on it forever.

Set in Vercel production:

```text
VITE_SUPABASE_URL=https://vpjmdsltwrnpefzcgdmz.supabase.co
VITE_SUPABASE_PROJECT_ID=vpjmdsltwrnpefzcgdmz
VITE_SUPABASE_ANON_KEY=<current anon key>
```

Then redeploy the frontend and smoke-test login/admin.

### Section 3.4 Configure GitHub Edge Function Deploy

Current workflow path:

```text
.github/workflows/deploy-supabase-function.yml
```

It needs:

```text
SUPABASE_ACCESS_TOKEN
```

Add that as a GitHub Actions secret or repository variable. Then run the
workflow manually once and confirm it deploys the same function:

```powershell
gh workflow run deploy-supabase-function.yml
gh run list --limit 5
gh run watch
```

### Section 3.5 Decide What To Do With Claude's Broad Stash

The broad stash may contain useful work, but it is too wide to trust as a
single production change.

Recommended review flow:

```powershell
git switch -c review/claude-broad-update
git stash list
git stash apply "stash@{N}"   # choose the stash whose message is "claude broad update - review later"
```

Review in slices:

1. Tooling only: package scripts, ESLint, Prettier, Husky, Vitest setup.
2. CI only: GitHub workflows and required secrets.
3. Docs only: runbooks, compliance docs, governance docs.
4. Database only: Supabase migrations and seed data.
5. Runtime code only: auth, security, KV, Supabase client, integrations split.

Do not merge the branch until `npm run build` passes and the current known test
state is understood. If the broad update adds lint/typecheck scripts, those
scripts must pass before hooks/CI enforce them.

### Section 3.6 Leaked-Password Protection — DONE (verified 2026-08-27)

**Current advisor state, read from the API on 2026-08-27: one lint.**
`rls_enabled_no_policy` on `kv_store_91ed8379`, INFO, correct by design — that
table is reached only with the service-role key, never from a browser, so a
policy would be theatre. `auth_leaked_password_protection` is **gone**: the
toggle was set and the advisor cleared.

The walkthrough below is kept as the record of what was done and why, not as an
outstanding instruction. The one part still worth acting on is the password
**length and character** guidance further down, which is separate from the
leaked-password toggle and cannot be read back over the API.

Prerequisite, satisfied: the feature is Pro-plan-and-above, and the organisation
(`cxmywgzojijcicjpqtds`) is on `pro` — verified 2026-08-27. On Free the control
renders disabled, so if it ever looks greyed out, the plan is the reason, not the
click-path.

**Path.** Dashboard → the project → **Authentication** → **Sign In / Providers**
→ expand **Email** → the password settings block. Direct link:

```text
https://supabase.com/dashboard/project/vpjmdsltwrnpefzcgdmz/auth/providers?provider=Email
```

Turn on the control that prevents the use of leaked passwords, then **Save**.
Supabase checks the candidate against the HaveIBeenPwned Pwned Passwords API
using a k-anonymity range query, so the password itself never leaves Supabase —
only a short prefix of its SHA-1 hash does.

Two things it does _not_ do, so nobody is surprised later:

- It applies at signup and at password change. Existing passwords are not
  re-checked and no session is invalidated. Users on a breached password stay
  logged in until they next change it.
- It is a breach-list lookup, not a strength rule. It will happily accept a
  weak-but-unbreached password. The strength rule is ours (below).

**While you are in that panel: set minimum password length to 12, and leave
"required characters" alone.**

Twelve matches what the app enforces — `validatePassword` requires `>= 12` in
both `src/utils/auth/passwordValidation.ts` (the live strength meter on the
signup form) and `src/supabase/functions/server/passwordValidator.ts`. So 12
brings the platform up to the app's own floor rather than tightening anything.

**The first version of this section claimed the character rule was already
enforced server-side, and it was not.** Two signup routes exist. `POST
/auth/signup` in `auth-routes.ts` has validated password strength for a long
time — and nothing calls it. The SPA posts to `/auth-signup/signup`, and there
the password went straight into `admin.createUser`: `PublicSignupSchema` asked
for `.min(1)`. `auth-validation.ts` says so in its own comment — "the gate was
on the wrong door." So the 12-character, 3-of-4 rule the signup form displays,
and disables its submit button on, was enforced by the browser alone. Anything
posting directly could set a one-character password on a real client account.
That is closed now: `auth-signup.ts` runs `validatePassword` before creating the
user, and `auth-signup-password.contract.test.ts` asserts the account is not
created when it refuses.

With that closed, the required-characters guidance stands, and here is the
reason. Our rule is "at least 3 of {uppercase, lowercase, digit, symbol}" — a
disjunction. Every dashboard option names a fixed set of classes that must _all_
appear, which no 3-of-4 rule can be expressed as. Pick any of them and you create
passwords the signup form's meter shows as valid and green, which Supabase Auth
then rejects with a raw API error the form has no copy for. Leave it as it is;
the character-class rule is now genuinely enforced on the client and on the route
the client calls.

Two related fixes went in alongside, both recorded here because they change what
a password is allowed to be:

- The common-password check matched every list entry as a bare substring, and the
  list contains fragments as short as `pi`, `adm` and `pass`. `Olympic$Rain42`,
  `Tropical#Sun88` and `Compass&Birch51` were all refused as "too common" — 3 of
  a 30-password strong corpus, 10%. Long entries now match anywhere after
  leetspeak is folded back (so `Str0ng!Passw0rd#2026` is still caught on
  `password`), and short entries match only at letter boundaries (so `Admin!2026`
  is caught and `Administer` is not).
- The signup meter and the server had drifted: 4 of 14 realistic passwords were
  shown "✓ Very strong password" and would have been refused. Both now run the
  same rule set, and `passwordValidator.agreement.test.ts` fails the build if
  they part again — they cannot import each other, because `no-spa-edge-source`
  forbids SPA code from importing Edge Function source.

**Verified.** The advisors were re-read after the toggle was set:
`auth_leaked_password_protection` is gone, one lint remains, the
`kv_store_91ed8379` INFO. Re-run `get_advisors` after any auth configuration
change to confirm it stays that way.

Not verifiable from here: whether minimum length and required characters were
actually set to the values above. Supabase's auth configuration is not readable
through the MCP tools, only its advisors are — so those two remain an operator
assertion, unlike the toggle, which the advisor proves.

### Section 3.7 Promote `e2e-smoke` To A Required Check

`e2e-smoke` has reported on every PR without being able to block one since it
landed, deliberately — see the header comment in
`.github/workflows/e2e-smoke.yml` for why a brand-new browser job earns trust
before it gets a veto. The bar it set for itself was roughly three consecutive
green runs. As of 2026-08-27 it has **26 consecutive green**: 29 of its last 30
runs succeeded, and the single non-success was `cancelled` by a superseded push
rather than a failure. It has earned the veto.

**Path.** Settings → **Branches** → the protection rule for `main` → **Edit** →
**Require status checks to pass before merging** → in the search box type
`e2e-smoke`, select it → **Save changes**.

```text
https://github.com/ShawnDaPrawn/NavigateWealth/settings/branches
```

The exact string is **`e2e-smoke`**. That comes from the _job's_ `name:` field,
not the workflow's `name: E2E Smoke` — GitHub keys required checks on the check
run's name, which is the job name when a job declares one and the job key
otherwise. `quality-check`, already in that list, gets its name the second way:
its job declares no `name:`, so the job key is the check name. The search box
only offers checks GitHub has seen on this repo recently, and `e2e-smoke` ran 26
times inside the last day, so it will be there.

**No open PR is stranded by the promotion** — checked at the time it was made.
The worry was that a PR whose head predates the requirement has no `e2e-smoke`
result on its head SHA, so it parks at "Expected — waiting for status" and
refuses to merge. That can only happen to a head pushed before the _workflow_
landed, not before the _promotion_: `e2e-smoke` has been running on every PR
since 2026-08-25, it just wasn't allowed to block. All three PRs open at
promotion time (#233, and drafts #238/#239) already carried a green `e2e-smoke`
on their heads. #233's `mergeable_state` is `behind`, which is base-branch
staleness and unrelated to this gate.

It stays a real failure mode for a branch that predates 2026-08-25 or whose
check run has since expired, so the way out is worth writing down:

- Push anything to the branch — `pull_request` fires on `synchronize`, so the
  check runs and reports.
- Actions → **E2E Smoke** → **Run workflow** → pick the branch. The dispatch
  attaches a check run to that branch's tip, which _is_ the PR's head SHA, and
  the gate clears. This is why `workflow_dispatch` was added to the workflow.

Do not clear it with an empty commit — a merge gate that trains people to push
empty commits is worse than no gate.

---

### Section 3.8 Set `SUPABASE_DB_URL` And Run The First Backup

One secret, then one button. It unblocks both the Backup and DR items, because
the same job now dumps AND restore-verifies.

**Take the SESSION POOLER string, not the direct connection.** This is the trap:
Supabase's own documentation says "use the direct connection string for
`pg_dump`", and following that advice here fails. The direct endpoint is IPv6
only without the paid IPv4 add-on, and GitHub Actions runners are IPv4 only —
Supabase's own IPv4 page lists GitHub Actions by name. The transaction pooler
(port 6543) is also wrong; it cannot serve `pg_dump`.

```text
https://supabase.com/dashboard/project/vpjmdsltwrnpefzcgdmz?showConnect=true&method=session
```

The string should carry port **5432** and a project-ref-suffixed user:

```text
postgresql://postgres.vpjmdsltwrnpefzcgdmz:[YOUR-PASSWORD]@aws-N-us-east-2.pooler.supabase.com:5432/postgres
```

Store it at Settings → Secrets and variables → Actions → New repository secret,
named exactly `SUPABASE_DB_URL`:

```text
https://github.com/ShawnDaPrawn/NavigateWealth/settings/secrets/actions
```

It is a database superuser credential. It belongs in that box and nowhere else —
not in a commit, a PR body, a doc, or a chat message.

Then run it once rather than waiting for Sunday:

```text
https://github.com/ShawnDaPrawn/NavigateWealth/actions/workflows/weekly-backup.yml
```

**Success looks like** `Backup verified: TOC complete AND every data block
decoded.` followed by `DR rehearsal passed: N tables, M rows, every index,
constraint and row-security flag intact.`, and an artifact `db-backup-<run_id>`
retained 90 days.

**That first successful run is what closes the DR rubric item.** Until it
happens the rehearsal is written but unproven — and note that
`weekly-backup.yml` is not exercised by `quality-check` at all, since it runs
only on its own cron and on dispatch. Every shell block in it was
syntax-checked and `compare-restore.py` was tested against nine failure modes,
but the restore itself has never touched real bytes.

| Failure message                                           | Cause                                                                                                                                                |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_DB_URL is not set — skipping`                   | Name typo, or stored as an environment secret rather than a repository one                                                                           |
| Connection timeout / no route to host                     | The direct connection was used. It is IPv6; the runner is IPv4                                                                                       |
| `password authentication failed`                          | Wrong password, or `[YOUR-PASSWORD]` left literal                                                                                                    |
| `kv_store_91ed8379 is absent from the dump`               | Wrong database                                                                                                                                       |
| `Restore produced errors unrelated to missing extensions` | Something in the schema failed to rebuild. Read the printed errors — the extension cascades are already filtered out                                 |
| `DR rehearsal FAILED`                                     | The real one. Rows, indexes, constraints or RLS did not survive the round trip. Do not trust the dump; the message names the table and what differed |

## Section 4 - Engineering Roadmap

Agents can do these, but should keep each change small and verified.

### Section 4.1 P0 - Keep The CORS Restore Stable

When touching `src/supabase/functions/server/index.tsx`:

- Preserve the fail-open fallback when `NW_ALLOWED_ORIGINS` is unset.
- Preserve strict allow-list behavior when `NW_ALLOWED_ORIGINS` is set.
- Preserve unauthenticated health routes.
- Preserve router-level auth for business routes.
- After any change, deploy the Edge Function and run live CORS preflight checks.

Acceptance:

- `npm run build` passes.
- Live `/health` returns `version: 4.1.0` or newer.
- Preflight from `https://www.navigatewealth.co` returns a matching
  `Access-Control-Allow-Origin`.

### Section 4.2 P0 - Review Broad Tooling Before Enabling Hooks

The attempted hotfix commit exposed a tooling problem:

- A pre-commit hook ran `eslint --fix`.
- `eslint.config.js` imported `eslint-plugin-react-refresh`.
- That package was not available in the current dependency set.
- The hotfix commit had to be made with `--no-verify`.

If adopting Claude's tooling, do it as its own PR/commit:

1. Apply only tooling files on a review branch.
2. Ensure every referenced package is in `package.json` and `package-lock.json`.
3. Add scripts gradually:
   - `lint`
   - `format`
   - `typecheck`
   - `test:coverage`
4. Run each script locally.
5. Only then enable Husky or CI enforcement.

Acceptance:

- `npm install` produces a consistent lockfile.
- `npm run build` passes.
- `npm test` behavior is documented and, ideally, fully green.
- Any new hook can be bypassed only for emergencies, not normal work.

### Section 4.3 P1 - Fix The Known Vitest Suite Issue — DONE (verified 2026-08-21)

> `resolveNestedKey.test.tsx` now uses real Vitest `describe`/`it` and the
> full suite exits 0 (502 files, 6842 tests). Kept for history.

Current `npm test` state after cleanup:

- `RouteGuards` and `calculations` test files pass.
- `resolveNestedKey.test.tsx` logs `17/17 passed`.
- Vitest fails the suite because the file does not register `test()` / `it()`.

Recommended fix:

1. Convert custom assertion logging in
   `src/components/admin/modules/resources/components/__tests__/resolveNestedKey.test.tsx`
   into normal Vitest `describe` / `it` tests.
2. Keep all 17 existing assertions semantically equivalent.
3. Run `npm test` and require a zero exit code.

Acceptance:

- `npm test` exits 0.
- The existing 17 checks remain represented as Vitest assertions.

### Section 4.4 P1 - Continue The `integrations.tsx` Split Carefully — DONE (verified 2026-08-21)

> The split is complete: `integrations.tsx` is a 37-line router composing
> seven `integrations-*-routes` modules. (Historical note: the "no boundary
> violations" claimed here reflected the pre-2026-08-21 vacuous depcruise
> resolver; the SPA-side boundary rules did not cover this edge split, and the
> resolver fix now surfaces 210 SPA-module violations — see the depcruise note
> in Section 0.) Apply the same split discipline to the remaining >1000-line
> modules listed in the 2026-08-21 addendum.

`src/supabase/functions/server/integrations.tsx` is still large and high-risk.
The first priority is reducing it without changing behavior.

Rules:

- One route group per PR/commit.
- Pure move first; behavior change later.
- Keep authentication and validation behavior identical.
- Keep shared types in existing type files unless a dedicated refactor is
  explicitly scoped.
- After every moved route, deploy or smoke-test the Edge Function path.

Suggested order:

1. Provider/root/config route slices.
2. Portal flow routes.
3. Portal job routes.
4. Portal worker routes. Treat these as a public contract for
   `scripts/provider-portal-worker.mjs`.
5. Upload/history/sync routes.
6. Schema/custom-key routes.
7. Policy routes.
8. Dashboard/stat routes.
9. Policy document routes.
10. Policy extraction routes.
11. Provider terminology routes.

Acceptance:

- The route count in `integrations.tsx` decreases.
- Moved routes return the same shapes as before.
- `npm run build` passes.
- Production deployment is not performed until the moved routes are verified.

### Section 4.5 P2 - Audit Logging And Compliance Work

Claude's broad update may contain audit/compliance scaffolding, but it is not
landed on clean `main`.

Before implementing:

1. Decide whether to adopt the broad-stash migration/docs.
2. Apply migrations to a disposable or staging Supabase project.
3. Verify table/RLS behavior before production.
4. Wire audit writes only after the schema is real.

Privileged actions that should eventually be audited:

- role or permission changes
- super-admin changes
- personnel create/update/delete
- client export/delete
- FNA approval or signed-document generation
- integration configuration writes
- security events such as 2FA changes, account suspension, password reset

### Section 4.6 P2 - Super Admin Fallback — CLOSED BY DECISION (2026-08-27)

**Do not remove `SUPER_ADMIN_EMAIL`.** This section previously ended "then
remove the fallback in a small, auditable change". Acting on that would now
REDUCE security, so the instruction is withdrawn rather than left to be
followed by the next reader.

The replacement landed as intended: a durable `SUPER_ADMIN_EMAILS` allowlist
with two recovery admins, a deploy-free env-var override, and
`isSuperAdminEmail()` as the single authorization entry point. Every
authorization check uses it. What changed is the conclusion about the const.

It has exactly two backend readers, and NEITHER should become
`isSuperAdminEmail()`:

1. `auth-routes.ts` exempts that one address from LOGIN RATE LIMITING, on an
   email taken from the request body, BEFORE authentication. That is a
   brute-force bypass. Widening it to the allowlist would extend the bypass to
   a second standing address and — through the `SUPER_ADMIN_EMAILS` env
   override — to whatever that variable happens to contain at the time.
   SECURITY-AUDIT A10 reached this conclusion independently and recorded it at
   the call site; the `@deprecated` tag on the const contradicted it.
2. `client-management-super-admin-routes.ts` resolves THE owner account to read
   or seed its profile. That is identity resolution, not authorization, and
   "the owner" is singular by definition — an allowlist would make it ambiguous.

The rule to carry forward, now stated on the const itself: **authorization goes
through `isSuperAdminEmail()`; a pre-auth exemption stays narrow; an owner
lookup stays singular.**

---

## Section 5 - Architectural Debt And Constraints

### Section 5.1 CORS Is Not Authorization

CORS protects browsers from reading responses cross-origin. It does not prove a
request is authorized. `requireAuth` and route-level permission checks are the
real security boundary.

Do not "secure" CORS in a way that bricks production when an operator forgets a
secret. The correct posture is:

- fallback open with a loud warning when unset
- strict allow-list when explicitly configured
- auth enforced everywhere that returns business data

### Section 5.2 Version-Pinned Imports Exist

The codebase uses imports like:

```ts
import { toast } from 'sonner@2.0.3';
```

Vite resolves these through aliases. Vitest now has matching aliases in
`vitest.config.ts`. If adding new version-suffixed imports, update test/build
resolution consistently.

### Section 5.3 Generated SEO Files Can Dirty The Tree

`npm run build` runs `scripts/seo/generate-seo-files.mjs`, which can update
`public/sitemap.xml` dates. If the build is only a verification step and no SEO
change is intended, restore generated timestamp noise before committing.

### Section 5.4 Broad Tooling Should Not Ship With Runtime Hotfixes

Tooling changes alter how every future change is made. They should be reviewed
separately from runtime fixes, especially when they introduce:

- new commit hooks
- new required npm scripts
- new CI checks
- dependency/lockfile churn
- formatters touching many files

### Section 5.5 Stashed Work Is Not Documentation Truth

If this document references a file that is not present on disk, the correct
state is "proposed/stashed," not "done." Future agents should verify with:

```powershell
git status --short
git ls-files <path>
Test-Path <path>
```

---

## Section 6 - Incident Log

Append-only. Add entries for regressions, near misses, and confusing cleanup
events that future agents could repeat.

### 2026-09-05 - Knowledge Base Entries Were Written But Never Read

- **Symptom:** Admins added entries in AI Management → Knowledge Base, tested
  Vasco, and Vasco answered as if the entries did not exist. Reported as "the
  seeding of the articles is not working".
- **Root cause:** Two disconnected systems that the UI presented as one.
  `kb-service.ts` stored entries at `ai:kb:*`; nothing on the server ever read
  them back except the admin list. The only retrieval path — `retrieveContext`
  in `vasco-rag-service.ts` — searched a separate index built from published
  Publications articles, and that index was refreshed only when an admin
  pressed "Re-index Articles" on a different tab. The portal advisor
  (`ai-advisor-chat.ts`) retrieved nothing at all despite `ragEnabled: true`.
- **Why it hid:** The KB tab reported "Active" with a green badge, the
  dashboard card was titled "Knowledge Base Index", and nothing compared what
  was stored with what was retrievable. A green status was describing the
  database row, not Vasco.
- **Fix (this change):** One index for both source kinds. Live KB entries are
  embedded into `vasco:emb:kb:*` / `vasco:chunk:kb:*` on every write
  (`syncKnowledgeEntry`, awaited by the KB routes, outcome returned to the UI);
  published articles sync on publish/unpublish/delete via fire-and-forget hooks
  (`vasco-index-sync.ts`); both Vasco agents retrieve through
  `retrieveContext(query, { agentId })`, which honours per-entry agent scope and
  priority. `GET /vasco/index` now reports indexed-vs-published/live counts so
  the Knowledge tab can say "up to date" or "N waiting to be indexed" with a
  rebuild button. Contract suite: `vasco-rag-service.contract.test.ts`.
- **Operator step:** Existing entries created before this change are not in
  the index until the first **Rebuild index** (AI Management → Knowledge). The
  tab shows them as "waiting to be indexed" until then.
- **Lesson:** A status badge must describe the effect, not the write. When a
  feature's value is "the AI knows X", the UI has to show whether the AI can
  actually retrieve X, and the thing that makes it retrievable has to happen on
  the same save — not on a button on another tab.

### 2026-08-25 - Scheduled Jobs Silently Not Running

- **Symptom:** None visible. No errors, no alerts, no failed requests. Found by
  reading `function_edge_logs` for 401/404 responses after unrelated work.
- **Scope:** 13 of 15 active `pg_cron` jobs were not performing their work —
  three never had, since creation.
- **Root causes:** (1) unsubstituted `<YOUR_PROJECT_REF>` / `<YOUR_ANON_KEY>`
  placeholder text in the job command, so `net.http_post` errored before sending;
  (2) six jobs targeting paths with no handler in the codebase; (3) cron auth
  comparing the bearer against `SUPABASE_SERVICE_ROLE_KEY`, which does not match
  the token the cron rows send.
- **Why it hid:** `cron.job_run_details.status` reports `succeeded` for all of
  them. `net.http_post` is asynchronous — it enqueues and returns a row id, so
  the job is green regardless of the HTTP outcome.
- **Fix:** Not applied. Every fix is a production write and most touch the
  service-role secret; the options are written up in
  `docs/runbooks/scheduled-jobs.md` for an operator decision.
- **Lesson:** A green scheduler is not a working scheduler. Any job that reaches
  a service over HTTP needs its _response_ checked, not its dispatch. Check the
  two planes separately (`cron.job_run_details` **and** `function_edge_logs`) —
  and when adding a scheduled job, verify the target path resolves to a mounted
  route before trusting the first green run.

### 2026-04-18 - CORS Allowlist Locked Production Out

- **Symptom:** Admin dashboard showed "Some dashboard data failed to load -
  Network error". `shawn@navigatewealth.co` lost module visibility. Browser API
  calls to the Edge Function were blocked by CORS.
- **Root cause:** The CORS fallback allowed only `http://localhost:3000` when
  `NW_ALLOWED_ORIGINS` was unset. Production origins were rejected.
- **Fix:** `index.tsx` now reflects any origin and logs a warning when
  `NW_ALLOWED_ORIGINS` is unset. Strict allow-list behavior applies only after
  the operator explicitly sets the env var.
- **Lesson:** Defense-in-depth controls must not become the sole gate. Auth is
  the real boundary; CORS should not brick the app during missing config.

### 2026-04-20 - CORS Restore Deployed And Verified

- **Action:** Deployed `make-server-91ed8379` to Supabase project
  `vpjmdsltwrnpefzcgdmz`.
- **Command used:**
  `npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .`
- **Commit:** `a9df9358 fix: restore Supabase Edge Function CORS`.
- **Verification:** Live health endpoint returned `version: 4.1.0`.
- **CORS verification:** Preflight from `https://www.navigatewealth.co`
  returned `204 No Content` with
  `Access-Control-Allow-Origin: https://www.navigatewealth.co`. Preflight from
  `https://navigatewealth.co` also passed.
- **Follow-up:** Set `NW_ALLOWED_ORIGINS` explicitly once all active origins are
  known, then redeploy and repeat preflight checks.

### 2026-04-20 - Broad Tooling Update Blocked Hotfix Commit

- **Symptom:** `git commit` failed because a Husky/lint-staged pre-commit path
  ran `eslint --fix`.
- **Root cause:** The broad Claude update included an `eslint.config.js` that
  imported `eslint-plugin-react-refresh`, but that package was not available in
  the current dependency set.
- **Resolution:** The emergency restore commit was made with `--no-verify`, and
  the broad tooling/code/docs update was stashed for review instead of shipping
  with the hotfix.
- **Lesson:** Do not bundle new tooling gates with production hotfixes. Tooling
  must first prove its own dependencies and scripts pass.

### 2026-04-20 - Roadmap Doc Corrected For Actual Repo State

- **Symptom:** Claude's first version of this file claimed broad tooling,
  workflows, migrations, compliance docs, strict TypeScript config, and other
  items were "done" on `main`.
- **Root cause:** The doc described the broad proposed update, not the cleaned
  repository after the CORS hotfix and stash quarantine.
- **Resolution:** This file was rewritten to distinguish landed, deployed work
  from proposed/stashed work.
- **Lesson:** Status documents must be verified against the working tree, not
  generated from an agent's memory of attempted changes.

---

## Section 7 - How Future Agents Should Use This File

| User question                            | Where to look                |
| ---------------------------------------- | ---------------------------- |
| "Is the app production grade?"           | Section 2 checklist.         |
| "What should I do now?"                  | Section 3, then Section 4.   |
| "What did Claude change?"                | Section 1.2 and Section 3.5. |
| "Why is CORS permissive?"                | Sections 1.4, 5.1, and 6.    |
| "Can I remove the super admin fallback?" | Sections 1.4 and 4.6.        |
| "Why did commits fail?"                  | Section 6 tooling incident.  |
| "Why does npm test fail?"                | Section 4.3.                 |
| "What should we refactor next?"          | Section 4, top-down.         |
| "How do I deploy the Edge Function?"     | Sections 3.2, 3.4, and 8.    |

Editing rules:

- Update Section 1 when the actual repo state changes.
- Append to Section 6 for every regression or near miss.
- Do not mark stashed/proposed work as done until it is committed and verified.
- Reference exact file paths and commands.
- When adding a new required command, confirm it exists in `package.json`.

---

## Section 8 - Command Reference

### Current Day-To-Day Commands

These exist in the clean `package.json` as of 2026-04-20:

```powershell
npm run dev
npm run build
npm test
npm run test:watch
npm run ui:inspect -- --path /admin --output tmp/ui-inspect/admin.png
npm run provider:sync
npm run provider:worker
```

Update 2026-08-21: the quality-gate scripts have since landed. `npm run
lint`, `npm run format`, `npm run format:check`, `npm run typecheck`,
`npm run typecheck:middleware`, `npm run typecheck:deno`, and
`npm run depcruise` all exist and pass (see the 2026-08-21 addendum).
Still absent: `npm run test:coverage` (use `npm test -- --coverage`),
`npm run deps:audit`, `npm run deps:boundaries` (use `npm run depcruise`),
and `npm run check-env`.

### Edge Function Deploy

```powershell
npx supabase login
npx supabase link --project-ref vpjmdsltwrnpefzcgdmz
npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .
```

### Health Check

```powershell
Invoke-WebRequest -UseBasicParsing https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/health |
  Select-Object -ExpandProperty Content
```

Expected shape:

```json
{ "status": "healthy", "version": "4.1.0", "requestId": "..." }
```

### Blocking post-deploy smoke

Runs automatically after every Edge Function deploy (`deploy-supabase-function.yml`).
Locally, against the currently deployed function:

```powershell
npm run deploy:smoke
```

Health probes must return 200; `/kv-store`, `/documents`, and `/profile` must
return 401 (including when the public anon key is sent as a bearer token).
A red smoke means the revision is already live — rollback by dispatching the
deploy workflow with the last green SHA as an input (`gh workflow run
deploy-supabase-function.yml -f revision=<last-green-sha>`), or by reverting
the merge on `main`. Do not pass the SHA to `--ref`; that option is a
branch/tag name, not a commit.

### CORS Preflight Checks

Production `www` origin:

```powershell
curl.exe -i -X OPTIONS "https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/health" `
  -H "Origin: https://www.navigatewealth.co" `
  -H "Access-Control-Request-Method: GET" `
  -H "Access-Control-Request-Headers: authorization,content-type"
```

Apex origin:

```powershell
curl.exe -i -X OPTIONS "https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/health" `
  -H "Origin: https://navigatewealth.co" `
  -H "Access-Control-Request-Method: GET" `
  -H "Access-Control-Request-Headers: authorization,content-type"
```

Expected:

```text
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: <the exact Origin header>
access-control-allow-headers: Content-Type,Authorization,x-client-info,apikey,x-request-id
access-control-allow-methods: GET,POST,PUT,DELETE,PATCH,OPTIONS
```

### Review Claude's Broad Stash Safely

```powershell
git switch -c review/claude-broad-update
git stash list
git stash apply "stash@{N}"
git status --short
npm run build
npm test
```

Use the stash with the message `claude broad update - review later`. Do not use
`git stash pop` until the branch is reviewed and you are sure the stash is no
longer needed.

---

## Section 9 - File Inventory

### Current Important Files On Clean `main`

- `AGENTS.md`
- `package.json`
- `vite.config.ts`
- `vitest.config.ts`
- `tsconfig.json`
- `supabase/config.toml`
- `supabase/functions/make-server-91ed8379/index.ts`
- `src/supabase/functions/server/index.tsx`
- `src/supabase/functions/server/integrations.tsx`
- `src/utils/supabase/info.tsx`
- `.github/workflows/deploy-supabase-function.yml`
- `docs/architecture/provider-portal-worker.md`
- `docs/archive/production-readiness-ledger-2026.md`

### Proposed/Stashed Files From Claude's Broad Update

These may be useful, but were not landed on clean `main` during the CORS
cleanup. Verify before referencing them as real:

- `quality/dependency-cruiser.cjs`
- `.editorconfig`
- `.env.example`
- `.github/workflows/ci.yml`
- `.github/workflows/weekly-backup.yml`
- `.prettierignore`
- `.prettierrc.json`
- `.vscode/settings.json`
- `CONTRIBUTING.md`
- `docs/adr/*`
- `docs/compliance/*`
- `docs/governance/*`
- `docs/runbooks/*`
- `docs/testing-strategy.md`
- `e2e/*`
- `eslint.config.js`
- `lighthouserc.cjs`
- `playwright.config.ts`
- `scripts/bootstrap-environments.ps1`
- `scripts/bootstrap-github-secrets.ps1`
- `scripts/check-env.mjs`
- `src/components/shared/ConsentBanner.tsx`
- `src/shared/schemas/*`
- `src/supabase/functions/server/audit-log.ts`
- `src/supabase/functions/server/integrations/*`
- `src/test/*`
- `src/types/ambient.d.ts`
- `src/utils/analytics/*`
- `src/utils/observability/*`
- `supabase/migrations/*`
- `supabase/seed.sql`
- `tsconfig.strict.json`

---

## Section 10a - Form Prefill (Tier A production track)

**Status (2026-05-23):** Tier A **production-ready** — Edge Function + frontend deployed, expanded smoke/parity/CI green, Playwright core paths pass on production. Remaining browser rows 4–8 and 10 are optional spot-checks (partially covered by automation below).

### Launch metadata

| Item                  | Value                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Edge Function deploy  | 2026-05-23 (final publish redeploy)                                                                                     |
| Production API smoke  | **PASS** — 6 `/prefill/resolve` + audit + `/form-templates` → `tmp/form-prefill-smoke-report.json`                      |
| Frontend deploy       | **Done** — Vercel `https://www.navigatewealth.co` (dpl_9k6nE4EBWh2UuXgaste5USGaQVyM)                                    |
| Rollback drill        | Pre-launch legacy-path build was verified; the launched path is now permanent and rollback is by code revert            |
| Access model          | **Platform-wide** — any adviser/admin (`form-prefill-auth.ts`)                                                          |
| Runbook               | [`docs/runbooks/form-prefill.md`](../runbooks/form-prefill.md)                                                          |
| E-sign tokens doc     | [`docs/compliance/form-prefill-esign-tokens.md`](../compliance/form-prefill-esign-tokens.md)                            |
| Template KV migration | [`scripts/ops/migrate-form-templates-to-storage.mjs`](../../scripts/ops/migrate-form-templates-to-storage.mjs) (Tier B) |

### Tier A production-ready checklist

- [x] Edge Function deploy green
- [x] Expanded `npm run form-prefill:smoke` PASS
- [x] Parity tests + prefill CI suite in quality-check
- [x] `npm test` green (306 tests incl. risk prefill guard + client-mode guard)
- [x] Frontend deployed to production (Vercel, 2026-05-23)
- [x] Playwright prefill spec — 5/5 on production (2026-05-23; incl. PDF template library deep link)
- [ ] Optional spot-check: browser rows 4–8, 10 in UAT doc (tax/estate/INA/conflicts/empty profile/intake accept)

### What is landed

| Area                            | Status                                                                    | Key files                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Shared resolver + registry      | Landed                                                                    | `src/shared/form-prefill/`, `src/supabase/functions/server/form-prefill-resolver.ts`                                    |
| API routes                      | Landed — auth, rate limits                                                | `form-prefill-routes.ts`, `form-prefill-auth.ts`, `form-prefill-rate-limit.ts`                                          |
| Review-before-apply UI          | Landed — all 6 FNA Step 1 + client drawer picker                          | `useFormPrefill.tsx`, `PrefillDomainPicker.tsx`, `PrefillReviewModal.tsx`                                               |
| Auto-populate API               | Landed — all six domain routes delegate to unified resolver               | `form-prefill-auto-populate.ts`, `*-fna-routes.*`                                                                       |
| Prefill audit                   | Landed — `GET /prefill/audit/:clientId` + drawer history panel            | `form-prefill-routes.ts`, `PrefillHistoryPanel.tsx`                                                                     |
| External PDF templates (Tier B) | Storage upload + checkbox/radio fill + drawer deep link                   | `FormTemplatesModule.tsx`, `form-template-routes.ts`, `FillExternalFormButton.tsx`                                      |
| Tests                           | Resolver + parity + risk guard + route auth + E2E spec + CI prefill suite | `__tests__/form-prefill-*.test.ts`, `Step1InformationGathering.prefill-guard.test.ts`, `e2e/form-prefill-smoke.spec.ts` |
| Ops                             | Smoke script + UAT matrix                                                 | `npm run form-prefill:smoke`, `docs/archive/2026-05-form-prefill-launch/uat-signoff.md`                                 |

### Deploy verification

```bash
npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .
npm run form-prefill:smoke
```

Smoke requires `e2e/.env.local` with `E2E_FNA_ADVISER_*` and `E2E_FNA_CLIENT_ID` (same actors as FNA intake UAT).

### Rollout status

- Unified form prefill has been the production path since 2026-05-23.
- The frontend rollout flag and legacy silent auto-populate branches were retired after launch;
  rollback is now by reverting the cleanup change.

### Known gaps (Tier C — not blocking Tier A sign-off)

- Legacy KV `:file` base64 templates still readable as fallback until migrated.
- Registry covers high-value fields, not every wizard input.
- Postgres audit table deferred (KV audit is v1).

---

## Section 10 - Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Author          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-04-18 | Initial Claude roadmap draft created, describing a broad production-readiness update and the original CORS incident.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Claude Opus 4.7 |
| 2026-04-20 | Corrected the roadmap against the clean repository state after the CORS restore. Added deployed verification, stash quarantine status, tooling-hook incident, accurate command list, and landed-vs-proposed inventory.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Codex           |
| 2026-05-23 | Form Prefill refinement: expanded smoke, parity tests, CI hooks, E2E hardening, migration script.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Agent           |
| 2026-08-21 | Architecture-quality verification: re-ran every quality gate on `main`, marked the completed roadmap items done (`integrations.tsx` split, Vitest suite fix, tooling gates, audit logging, super-admin allowlist), corrected the Section 2 rubric and Section 8 command list, and recorded remaining debt (four >1000-line server modules, ~31% coverage floor, 59-warning lint baseline).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Claude          |
| 2026-08-22 | Added `docs/ROADMAP.md`: the consolidated, re-verified execution roadmap for the remaining technical-debt / readability / code-organisation work (security remainder WS0, frontend and backend organisation, data layer, platform split, delivery confidence), with current ratchet values measured from the tree at `255f708`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Claude          |
| 2026-08-24 | Blocking post-deploy smoke (roadmap §8.1): health + gated-route 200/401 probes fail the Edge Function deploy job; rollback documented in the workflow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Agent           |
| 2026-08-24 | Moved the thirteen ratchet baseline files from the repo root into `quality/baselines/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Claude          |
| 2026-08-24 | Issue Manager burn-down: upgraded `sharp` to `^0.35.3` (npm audit high+critical floor 0), treat stale React.lazy `.default` crashes as a one-shot chunk reload, and default the findings list to Open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Agent           |
| 2026-08-24 | A18 / roadmap §5.4: extracted `createApp()` into `create-app.ts`, leaving `index.tsx` as the console override plus `Deno.serve(createApp().fetch)`. The root error handler, request-id middleware, CORS allow-list and health probes now have direct tests (28). A mount registrar that throws is no longer silent — `/health/ready` answers 503 `checks.mounts: 'fail'`, so the post-deploy smoke fails a partial boot. Backend coverage floors 15.0/10.6/14.8/15.4 → 17.3/12.5/16.8/17.7.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Agent           |
| 2026-08-24 | D2 closed: migrations reconciled against production. Every applied version now has a matching file (five verbatim from `schema_migrations`); five previously-untracked tables captured in an idempotent baseline; two mis-stamped files corrected. Fixed two live defects found while reconciling — the H-12 RLS gap (a client could mutate or self-accept a submitted FNA), unapplied since June, and 1,084 duplicate KV indexes (1,573 MB → 2,456 kB; every write maintained 1,085 B-trees).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Agent           |
| 2026-08-24 | Roadmap §5.5: classified all 123 routes on the F3 review list — 85 public by design, 35 guarded by a mechanism the detector cannot see, 3 genuine gaps. Fixed the three (`integrations-schema-routes.ts` reads were world-readable while the sibling write required admin) and added a registry the test enforces in both directions, so the number is now an inventory rather than a mystery. Baseline 123 → 120. Doubles as the public-surface inventory for the verify_jwt flip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Agent           |
| 2026-08-25 | Roadmap §7.2/§7.3 prerequisites: post-deploy smoke now probes the public surface (signup + a lead-gen form, both side-effect free), probes declare `surface: public\|gated` with a structural test enforcing the boundary, and `public-surface-inventory.test.ts` resolves every public route to a real URL through the mount tree. The `verify_jwt` flip itself was NOT done: `publicAnonKey` ships in the SPA and IS a valid signed JWT, so the gateway check blocks tokenless probing rather than anonymous access — recorded as defence-in-depth, recommended attended.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Agent           |
| 2026-08-25 | Roadmap §8.2: first two route-family contract suites (resources-routes, tasks-routes). Found and fixed a 500-on-malformed-JSON in `POST /tasks` (a client error reported as a server fault, which also polluted the runtime-issue recorder). Backend coverage 17.39% → 17.70% statements across 949 tests; floors raised.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Agent           |
| 2026-08-25 | Security-advisor burn-down: pinned `SET search_path` on all nine flagged functions and revoked the PUBLIC EXECUTE grant on four SECURITY DEFINER helpers nothing calls. Supabase security lints **17 → 2** (remaining: kv_store `rls_enabled_no_policy`, correct by design; leaked-password protection, an operator toggle). Also pinned the same clause in the two setup-SQL sources, which would otherwise have silently undone it via `CREATE OR REPLACE`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Agent           |
| 2026-08-25 | Roadmap §8.3: first e2e journey running in CI (`e2e-smoke` workflow). Opens `/` and `/get-quote` in real Chromium (desktop + mobile), asserts each actually painted, and clicks a service card to prove the quote wizard advances. Credential-free, submits nothing. Reports on every PR but is NOT yet a required check — promote after ~3 green runs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Agent           |
| 2026-08-25 | Roadmap §7.5: `npm run metrics` answers error-rate and p50/p95 per route family from `function_edge_logs` — no request-path instrumentation, because Supabase already records every field the gate asks for. **Baseline: error rate 0.02% (1 5xx in 6,049). Latency poor — the static no-IO `/health` handler is 1,497 ms p50 (n=20), against 1,918 ms for a real data route.** That locates the cost outside application query work, but does NOT by itself establish cold start as the cause: `execution_time_ms` does not distinguish warm from cold isolates. Measure with controlled warm/cold probes before committing to Stage E on this basis.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Agent           |
| 2026-08-27 | Wrote the two operator-only gates down as click-paths (§3.6, §3.7) instead of leaving them as advisor line items. Leaked-password protection: confirmed the org is on `pro` so the control is actually available, and established that minimum length should be set to 12 to match `validatePassword` while **required characters must be left alone** — our rule is 3-of-4 classes, every dashboard option is all-of-N, so any of them rejects passwords the signup meter just showed green. `e2e-smoke`: 26 consecutive green runs clears the ~3-green bar it set itself, so recorded the exact required-check string (`e2e-smoke`, from the job's `name:`, not the workflow's) and added `workflow_dispatch` so a required check has a manual way to report on a head carrying no result, the only other route being an empty commit. The three PRs open at promotion time turned out not to need it: `e2e-smoke` has reported on every PR since it landed on 2026-08-25, so all three already had a green result on their heads. Stranding needs a head older than the workflow, not older than the promotion — corrected in §3.7 and the workflow header, which had claimed otherwise.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Agent           |
| 2026-08-27 | Closed a live signup hole a Codex review found while checking §3.6's claims. Two signup routes exist; `validatePassword` guarded `POST /auth/signup`, which nothing calls, while the SPA's `/auth-signup/signup` passed the password straight to `admin.createUser` behind a `.min(1)` schema — the 12-character, 3-of-4-class rule the form displays was enforced by the browser alone, so anything posting directly could set a one-character password on a client account. Wiring the validator in exposed two more: the meter and the server had drifted (4 of 14 realistic passwords read "✓ Very strong" and would have been refused), and the common-word check substring-matched fragments as short as `pi`, refusing `Olympic$Rain42`, `Tropical#Sun88` and `Compass&Birch51` — 10% of a strong corpus, each told it was "too common". Long entries now match after leetspeak folding (`Str0ng!Passw0rd#2026` still caught), short ones only at letter boundaries (`Admin!2026` caught, `Administer` not). 57 new tests, two of which fail the build if the two validator copies drift again — they cannot import each other under `no-spa-edge-source`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Agent           |
| 2026-08-27 | The report-only CSP had been reporting **nowhere** — no `report-uri`, no `report-to`, no `Reporting-Endpoints` — so every visitor's browser evaluated it and discarded the result, and the "probe then promote" plan had no evidence to promote from. Added a collector (both wire formats; URLs reduced to origin+path, because a violation on `/sign?token=…` would otherwise carry the signer's live credential into the KV store). Dropped `'unsafe-inline'` from `script-src`: that needed the per-route SEO guard parameterised via `data-seo-path` (27 distinct inline scripts → 2, so a renamed slug can no longer silently invalidate a hash) and `App.tsx`'s injected `innerHTML` gtag script replaced with a direct call, its text having varied with the URL and so been unhashable. Also found the earlier "8 routes, zero violations" verification had missed the signer flow, which this policy would have BROKEN: `SigningWorkflow.tsx` loaded the pdf.js worker from jsdelivr, which `worker-src 'self' blob:` forbids — so enforcing it would have stopped a client signing a document, and taken a third-party CDN off the e-sign critical path was overdue anyway. Re-verified ENFORCED over TLS across 20 routes including `/sign` and `/admin`: 0 violations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Agent           |
| 2026-08-27 | Reframed the rubric for a real budget constraint instead of leaving two boxes unchecked forever. Built the **DR** rehearsal at zero cost — the earlier framing said the bar was "a throwaway project", which made it look blocked on money; what needs proving is that the dump loads into a live schema intact, and a `postgres:17` service container proves that as well as a second Supabase project does. It restores weekly and compares 30 tables across `public` and `auth` on rows, indexes, constraints and RLS, classifying every restore error against a runtime-derived list of extensions the image cannot install. **Left DR unchecked**: the secret is not configured, so not one run has happened and checking it would record automation as verified — the exact failure this document exists to prevent. Credited what the Backup item never did: Pro already takes a daily backup with 7-day retention, so the wording implying an unprotected database was inaccurate; the workflow's value is being off-vendor. Staging and PITR became recorded spending DECISIONS with compensating controls and stated residual risk. Confirmed repo/production migrations are not drifted. Accepted the RSS-thumbnail breakage: the remote investing.com fallback would have been blocked in turn and reassigning `src` to a failing URL invites an onError loop, so it is a local placeholder now and that origin came out of `img-src`.                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Agent           |
| 2026-08-27 | Performance: the app was shipping **864 MB of images**, and the mechanism to prevent it already existed and had never worked. `figmaAssetResolver` in vite.config.ts prefers an optimized sibling over the raw Figma export — but it looked only for `.webp`, and there are no `.webp` files in `src/assets`; the optimized exports are `.jpg`. So every one of the 84 imports fell through to the original, and those originals are camera-scale exports up to **8256x5504**. Sixty-two had a 2200x1467 sibling of ~300 KB sitting unused beside them. Adding `.jpg`/`.jpeg`/`.avif` to the candidate list took dist images **864 MB -> 78 MB**. (CORRECTED 2026-08-30: this row first claimed the home page fell to 3.16 MB. That number summed every file the page references, including the `<img src>` JPEG fallbacks inside a `<picture>`, which a browser does not download when a `<source>` matches. It overstated what a visitor actually fetches.) `figma-asset-weight.test.ts` now resolves every import the way Vite does and fails on anything oversized, because nothing would have caught this: it is invisible in development and the bundle baseline had been captured AFTER the regression, so the wrong number was the floor — that floor is now 78 MB, not 864 MB. Also moved 12 MB of unreferenced brand source out of `public/` (it was being served, including 6 MB of `.zip` logo archives and `.tiff`/`.pdf` no browser renders). STILL AVAILABLE, not done: a full responsive AVIF/WebP set for 68 of the 84 assets already exists in `public/img/optimized/` with a `ResponsiveImage` component and an `npm run optimize:images` generator. (CORRECTED 2026-08-30: this row first said that component was wired only into the nav mega-menu. It is also used in `ServicePageTemplate.tsx`, `homePageSections.tsx` and `ServicesPage.tsx`; the gap was narrower than stated.) | Agent           |
| 2026-08-29 | Client load speed: took a rich-text editor and an animation library off the critical path. `vite.config.ts` decided chunk membership with `id.includes('/react/')`, a substring test that matches `node_modules/@tiptap/react/…`, so `@tiptap/react` was pinned into `vendor-react` — the chunk every visitor downloads because React lives there — and Rollup followed with prosemirror-view/model/transform/state/commands and `@tiptap/core`. React and React-DOM were 141 KB of that chunk's 936 KB rendered bytes; the admin-only editor was 795 KB. `/react-dom/` caught `@floating-ui/react-dom` the same way. Independently, `vendor-feedback` grouped `motion` with `sonner`, and since `AppProviders` mounts the app-wide `<Toaster/>` while all 11 `motion` importers are behind lazy routes, the toast dragged 383 KB of animation onto first paint. Chunk rules now match the package name parsed from the module id. **Eager entry 1.82 MB → 1.44 MB, 489.7 KB → 369.2 KB gzipped (−24.6%)**, re-baselined into F6; `totalJsBytes` +0.3%, so nothing was deleted or duplicated — the weight moved off the critical path. No application code changed. Also moved connection hints out of a `PerformanceOptimizer` `useEffect`, where they were created after React had mounted and so after the handshake they were meant to overlap: the Supabase origin the auth bootstrap calls on every load was never hinted at all, while two of the four that were (`fonts.googleapis.com`, `via.placeholder.com`) are origins this app never contacts. Measured and rejected in the same pass: unassigning `@radix-ui/*` so Rollup places it automatically — worse, 369 KB → 554 KB gzipped.                                                                                                                                                                                                       | Agent           |
| 2026-08-29 | Provider logos were served at 24x their display size: sixteen 2000x1000 PNG exports totalling 4,902,054 bytes filled slots no wider than 200 CSS px. Every step of the pipeline worked as designed — `optimize-images.mjs` builds variants for hashes behind an `imageKey`, the logos had none, so `ResponsiveImage` was unreachable and `OptimizedImage` (which only builds a srcSet for `unsplash.com` URLs) emitted a bare `<img>` with the full-size file. Adding a key is what asks for generation, and nothing had. They now carry a `logoKey`, built at 200/400 rather than the four page widths: at 1024 and 1440 these sources come to about 2.5 MB of variants no `sizes` attribute can select, which is half the weight being removed. Measured fetching all sixteen: 4.67 MB to 44.2 KB at 200w AVIF; confirmed in a browser against `dist` as 14,413 bytes for the four visible, no PNG fallback requested. Also fixes cropping the call sites never asked for — their `object-contain` sat on a wrapper div while the inner `<img>` was hardcoded `object-cover`. `optimize-images.mjs` now skips outputs newer than their source (`--force` to override); it had re-encoded all 86 targets every run, rewriting ~700 binary files and burying the real change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Claude          |
| 2026-08-30 | The image work above had a second half that was never built, and a floor underneath it that never existed. `figmaAssetResolver` now resolves through a generated cache first: `scripts/build/generate-figma-webp.mjs` runs before `vite build` and emits a WebP per imported asset into `node_modules/.cache/figma-webp/` — **811.5 MB of originals -> 10.0 MB**, largest **408 KB**, held there by an encode ladder that re-compresses anything over a hard 500 KB ceiling and exits non-zero if a source defeats it. `imageBytes` **906 MB -> 55.6 MB**, `totalDistBytes` **927 MB -> 70.9 MB**; every one of the 82 emitted images is WebP and none exceeds 500 KB. The JS floors were deliberately NOT re-baselined: they had drifted +0.2% from an unrelated merge, and raising a budget is not something an image change should do. The cache is keyed on file _contents_, not mtime — git does not preserve timestamps, so an mtime key would miss on every asset on every fresh checkout. **The committed `.jpg`/`.avif` siblings stay in the ladder underneath it**, so a cold or failed cache degrades to a ~300 KB JPEG instead of silently reinstating the 31 MB PNGs; `figma-asset-weight.test.ts` measures that cold path deliberately, since it is the half no build step watches, and now checks its own candidate list against `vite.config.ts` so the mirror cannot drift. Two bugs found while folding this in: the generator skipped every directory _named_ `assets`, which swallowed `src/components/shared/assets/provider-logos.ts` and left all sixteen provider logos unconverted while reporting a healthy run; and transparency was unverified — now checked with `stats().isOpaque`, which distinguishes a logo with real alpha from one carrying a redundant fully-opaque channel that libwebp is right to drop. Both guards were mutation-tested.                         | Claude          |
