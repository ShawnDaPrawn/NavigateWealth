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

Deploy the backend function with:

```bash
npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .
```

The GitHub workflow at `.github/workflows/deploy-supabase-function.yml` deploys the function on relevant pushes to `main` when `SUPABASE_ACCESS_TOKEN` is configured.

## Database Migrations

Migrations live in `supabase/migrations/`. Current notable migrations include:

- `20260420000001_esign_core_tables.sql`
- `20260520000001_fna_intake_sessions.sql`

Apply database migrations deliberately and verify against staging/disposable environments before production promotion.
