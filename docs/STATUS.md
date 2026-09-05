# Status

**What this is.** The current state of Navigate Wealth on `main`: what runs,
what is deliberately the way it is, and what is still open on an operator's
desk. Read this before proposing a large change.

**What this is not.** A history. Dated snapshots, superseded plans and closed
launch records live in [`archive/`](archive/). The sequenced list of what to
build next is [`ROADMAP.md`](ROADMAP.md). Incidents are in
[`INCIDENTS.md`](INCIDENTS.md).

**How to keep it true.** This file is rewritten, never appended to. If you find
yourself adding "Addendum as of &lt;date&gt;", you are turning it back into the
1,791-line ledger it replaced — edit the statement that is now wrong instead.
Where a number lives in a file, this document links to that file rather than
repeating the number, because a repeated number is a number that will be stale.

---

## The shape of the system

| Part              | What it is                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend          | React SPA on Vite + TypeScript. A single `package.json` — not a monorepo.                                                                                                                 |
| Backend           | One Supabase Edge Function (Deno + Hono), `make-server-91ed8379`, at `https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379`.                                        |
| Deploy entrypoint | `supabase/functions/make-server-91ed8379/index.ts`, which imports `src/supabase/functions/server/index.tsx`.                                                                              |
| Data              | Supabase Postgres. A large amount still lives in the `kv_store_91ed8379` KV table, reached with the service-role key; migration to real tables is incremental and tracked in the roadmap. |
| Hosting           | Vercel for the SPA, with `middleware.ts` at the edge.                                                                                                                                     |
| Local dev         | No local backend needed. `npm run dev` serves the SPA against the deployed Edge Function.                                                                                                 |

Architecture write-ups for individual subsystems are in
[`architecture/`](architecture/). Operational procedures are in
[`runbooks/`](runbooks/).

## Deployment is automatic

Edge Function changes deploy when they land on `main`, via
`.github/workflows/deploy-supabase-function.yml`. **Do not run
`supabase functions deploy` by hand.** The frontend deploys from `main` through
Vercel. `AGENTS.md` carries the full protocol.

## Quality gates

Every PR is gated by `.github/workflows/quality-check.yml`: format, ESLint,
three typechecks (SPA, middleware, Deno), dependency-cruiser boundaries, unit
tests, coverage floors, and the production build. `e2e-smoke` is a required
check as well.

Several gates are **ratchets** rather than pass/fail rules: a committed number
records the current size of a known backlog, and CI fails if the real count
moves the wrong way. The numbers themselves live in
[`quality/baselines/`](../quality/baselines/README.md) — read them there, and
lower them as debt is burned down. Do not restate them here.

Two constraints on the gates that are easy to trip over:

- **`npm run typecheck:deno` needs network access to `jsr.io`** to resolve
  `@supabase/supabase-js` types. In restricted sandboxes that block it
  (`403 host_not_allowed`) the check reports spurious `TS7006` implicit-`any`
  errors. CI is authoritative for this gate; say so rather than committing
  unverified Edge Function changes.
- **`tsconfig.typecheck.json` deliberately excludes the Edge Function source.**
  It runs under Deno with `jsr:`/`npm:` imports and Deno globals, and must be
  checked with `deno check`, not `tsc`.

## Deliberate fallbacks — do not "fix" these in passing

Each of these looks like a bug and is not. Removing one without meeting its
stated prerequisite has already caused a production outage once.

| Where                                        | The fallback                                                                                                                           | Why it exists                                                                                                                                                                                | What must be true before removing it                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/supabase/functions/server/index.tsx`    | When `NW_ALLOWED_ORIGINS` is unset, reflect the incoming browser origin and log a warning. A strict allow-list applies when it is set. | Prevents a repeat of the 2026-04-18 CORS lockout. Auth, not CORS, is the authorization boundary.                                                                                             | Every real SPA origin is known and set in `NW_ALLOWED_ORIGINS`, and preflights pass from each one.                                                             |
| `supabase/config.toml`                       | `verify_jwt = false` on the function.                                                                                                  | The function exposes anonymous health probes.                                                                                                                                                | Health probes move to an unauthenticated sibling function. Until then, **every sub-router must apply its own auth at mount time** — this is the real boundary. |
| `src/utils/supabase/info.tsx`                | Hardcoded project ref and anon key fallback.                                                                                           | Lets the SPA boot without local env vars.                                                                                                                                                    | Vercel production and preview env vars are pinned and verified.                                                                                                |
| `src/supabase/functions/server/constants.ts` | `SUPER_ADMIN_EMAIL` as a single const, alongside the `SUPER_ADMIN_EMAILS` allowlist.                                                   | **Closed by decision, 2026-08-27 — do not remove.** Its two readers are a pre-auth rate-limit exemption and a singular owner lookup. Widening either to the allowlist would reduce security. | Nothing. Authorization goes through `isSuperAdminEmail()`; the pre-auth exemption stays narrow; the owner lookup stays singular.                               |
| `middleware.ts`                              | Kept free of imports from the SPA source tree.                                                                                         | Importing SPA modules breaks the Vercel Edge build.                                                                                                                                          | Nothing — this is a permanent constraint of the Edge runtime.                                                                                                  |

## Standing constraints

- **CORS is not authorization.** `requireAuth` and route-level permission checks
  are the security boundary. Do not harden CORS in a way that bricks production
  when a secret is missing.
- **Version-pinned imports exist** (`import { toast } from 'sonner@2.0.3'`).
  Vite resolves them through aliases and `vitest.config.ts` mirrors those
  aliases. Add a new version-suffixed import to both or tests will not resolve it.
- **`npm run build` can dirty the tree.** It regenerates SEO files and can bump
  timestamps in `public/sitemap.xml`. If the build was only a verification step,
  restore that noise before committing.
- **`pg_cron` reports `succeeded` for a job that did nothing.** `net.http_post`
  enqueues asynchronously, so the job is green whether the eventual response is
  200, 401 or 404. `cron.job_run_details` alone cannot tell you a scheduled job
  is healthy — see [`runbooks/scheduled-jobs.md`](runbooks/scheduled-jobs.md).
- **Tooling changes ship separately from runtime fixes.** New hooks, required
  scripts, CI checks and formatter sweeps change how every future change is
  made, and have blocked a hotfix before.

## Open operator items

These need dashboard or credential access. An agent can prepare and verify them
but cannot complete them.

| Item                                              | State                                                                                                                                                                                                                                   | Detail                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Retired cron rows still hold the service-role key | **Open.** Seven dead jobs were retired with `active = false`, which leaves `command` untouched; five rows (jobids 18–22) still contain the key in plaintext. Any rotation of the service-role key must also drop or rewrite those rows. | [`runbooks/scheduled-jobs.md`](runbooks/scheduled-jobs.md#the-retired-jobs-still-hold-the-service-role-key-open-2026-08-30) |
| `SUPABASE_DB_URL` secret and first backup run     | Open until one `weekly-backup` run has passed. Until then the disaster-recovery rehearsal is written but unproven. Use the **session pooler** string on port 5432, not the direct connection (IPv6-only; runners are IPv4).             | Archived ledger § 3.8                                                                                                       |
| Supabase password policy                          | The leaked-password toggle is on and verified. Minimum length 12 and leaving "required characters" alone are operator assertions — Supabase auth config is not readable over the API.                                                   | Archived ledger § 3.6                                                                                                       |
| `NW_ALLOWED_ORIGINS`                              | Set it deliberately once every origin is known; until then the permissive fallback above is load-bearing.                                                                                                                               | Archived ledger § 3.2                                                                                                       |

## Open security follow-ups

The June 2026 audit's P0/Critical findings were remediated in the August
migrations. These follow-ups from the same audit were **not**, and are recorded
here so the archive banner is not mistaken for an all-clear. Detail and finding
IDs: [`archive/2026-06-security-audit.md`](archive/2026-06-security-audit.md).

| Finding        | What is still open                                                                                                                                                                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-5 (rotation) | **Owner action.** When no platform signing certificate is provisioned in the environment, `esign-pdf-protect.ts` falls back to storing the private key and its passphrase in KV — application-readable storage. The code logs a warning when it takes that path. Provision the certificate and rotate the key to close it. |
| H-3 / H-4      | Rate limiter is not fail-closed, needs atomicity, and OTP brute-force protection                                                                                                                                                                                                                                           |
| H-6 / H-9      | E-sign download and attachment ownership checks                                                                                                                                                                                                                                                                            |
| H-11           | Upload size limits                                                                                                                                                                                                                                                                                                         |
| M-7            | XSS sink hardening                                                                                                                                                                                                                                                                                                         |
| M-12           | Idempotency body caching                                                                                                                                                                                                                                                                                                   |
| —              | `POST /requests/:id/submit` has never existed server-side; the client-facing request completion flow 404s on submit. Needs a product decision, not just a fix.                                                                                                                                                             |

## Where money, not work, is the blocker

When answering "is this production grade?", give both halves: whether every box
that work alone can close is closed, and, for each box left open by a spending
decision, the decision, the compensating control, and the residual risk. Never
report one of these as merely "unchecked", and never quietly recategorise it as
done.

| Item                   | Decision                                 | Compensating control                                                                 | Residual risk                                                   |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Staging project        | Not affordable                           | Vercel previews; `quality-check` and `e2e-smoke` both required                       | Migrations reach production with no prior run                   |
| Point-in-Time Recovery | Declined at ~$100/mo for 7-day retention | Supabase daily backup (7-day) plus a weekly off-vendor dump that is restore-verified | RPO up to 24 hours: a failure at 23:00 can lose that day's work |

Everything else is achievable at no additional cost, so anything else still open
is work not yet done, not budget.

## Known debt, tracked not blocking

- **The Edge Function source is 480+ files flat in one directory**, organised by
  filename prefix. The three subfolders that exist (`locked/`,
  `quote-verticals/`, `repositories/`) show the shape it should take. Split one
  prefix per PR; see [`ROADMAP.md`](ROADMAP.md).
- **KV-first data access.** Large parts of the domain still read and write the
  KV table with the service-role key, bypassing row-level security. The
  `kv-direct-access` ratchet holds the line while it is migrated.
- **Coverage floors are low.** They prevent regression; they do not indicate
  good coverage. Report the SPA and backend figures as two separate numbers.
