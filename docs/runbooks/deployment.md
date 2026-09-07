# Deployment

**What this is.** How each part of the system reaches production, and what to do
when one of them needs a hand.

> **Deployment is automatic and should stay that way.** Edge Function changes
> deploy when they land on `main`; the frontend deploys from `main` through
> Vercel. **Do not run `supabase functions deploy` by hand** — `AGENTS.md`
> explains why a manual deploy has caused problems before. What follows describes
> the machinery and the manual paths that exist for recovery, not a routine.

## Frontend

The frontend is built by Vite and deployed from `dist/`. `vercel.json` configures:

- `dist` as the output directory.
- A canonical host redirect from `navigatewealth.co` to `www.navigatewealth.co`.
- Long-lived immutable caching for `/assets/*`.
- SPA rewrites to `index.html`.
- `X-Robots-Tag: noindex, nofollow` for app/admin/auth/dashboard-style routes that should not be indexed.

## Supabase Edge Function

**There is no working manual deploy, and this is the important part of this
page.** An earlier revision of this runbook printed a raw
`npx supabase functions deploy …` command. Running it does not merely skip a
check — it fails: the function's source graph measures over Supabase's hard
5 MB payload limit, and `scripts/build/strip-edge-function.mjs` is what brings it
down to roughly 3.2 MB. The workflow also runs a **blocking** post-deploy smoke
(`scripts/ops/post-deploy-smoke.mjs`) that verifies the live authorization boundary
before the deploy is considered good. A hand-run CLI deploy does neither.

Deployment happens automatically when a change to any of these lands on `main`:

```text
src/supabase/functions/**
supabase/functions/**
supabase/config.toml
scripts/ops/post-deploy-smoke.mjs
scripts/build/strip-edge-function.mjs
.github/workflows/deploy-supabase-function.yml
```

### Re-running a deploy

Dispatch the workflow. With no input it deploys the dispatched branch's HEAD:

```bash
gh workflow run deploy-supabase-function.yml
```

### Rolling back a bad revision

Pass the last known-good commit SHA as the `revision` input:

```bash
gh workflow run deploy-supabase-function.yml -f revision=<last-green-sha>
```

Use `-f revision=<sha>`, **not** `--ref <sha>`: `gh` accepts only a branch or
tag for `--ref`, so `--ref <sha>` would silently redeploy that branch's HEAD —
which on a rollback is precisely the revision you are trying to get away from.

The workflow needs `SUPABASE_ACCESS_TOKEN` configured as a repository secret.

## Database Migrations

Migrations live in `supabase/migrations/`. Current notable migrations include:

- `20260420000001_esign_core_tables.sql`
- `20260522225558_fna_intake_sessions.sql`

Apply database migrations deliberately and verify against staging/disposable environments before production promotion.
