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
- A canonical host redirect from `navigatewealth.co` to `www.navigatewealth.co`,
  **excluding `/resources/article/*`** — see below.
- Long-lived immutable caching for `/assets/*`.
- SPA rewrites to `index.html`.
- `X-Robots-Tag: noindex, nofollow` for app/admin/auth/dashboard-style routes that should not be indexed.

**`vercel.json` must never contain a legacy `routes` array.** `routes` is the
pre-2020 routing format and Vercel treats it as mutually exclusive with
`redirects`, `headers`, `rewrites`, `cleanUrls` and `trailingSlash`. From
2026-09-05 to 2026-09-20 the file carried both, the build did not fail, and
production silently ran on the `routes` block alone: every `redirects` entry
(the apex→www canonical redirect, the duplicate-article redirect) and every
security header in `headers` was dead configuration for those two weeks. See
`docs/INCIDENTS.md` (2026-09-20). The SPA fallback and the per-path headers now
live in `rewrites` and `headers`, which compose with `redirects`.

### The apex host serves articles on purpose

Article notification emails link to `https://navigatewealth.co/resources/article/…`
— the apex, not `www`. That is the whole point: the PWA manifest is served from
`www` with `scope: "/"`, so the installed app's intent filter covers every `www`
path and none of the apex. Clients who installed the portal app would otherwise
have every emailed article link captured into it.

**The apex must answer those URLs itself, not redirect them.** Android applies
installed-app link capture to server redirects as well as to the tapped URL, so
an apex link that 301s to `www` is handed to the app anyway — and the app's
escape interstitial then aimed back at the apex, which redirected into scope
again. Clients saw the browser and the app trade the link back and forth in an
endless loading loop. The `(?!resources/article/)` exclusion in `vercel.json` is
what stops it, and `src/__tests__/apex-article-escape-routing.test.ts` pins it.

This requires `navigatewealth.co` to be **attached to the Vercel project as a
serving domain**, so requests reach the deployment and `vercel.json` decides what
to redirect. It does _not_ work if the apex is configured as a Vercel
"Redirect to `www.navigatewealth.co`" domain, or redirected at the DNS/registrar
level — those happen before the deployment is reached, so the exclusion never
runs and the loop returns.

**As of 2026-09-20 neither half of that is in place**, and it is the reason
Search Console reports the home page variants as "Page with redirect" from a
redirect the repository does not control:

- The `navigate-wealth` Vercel project serves only `www.navigatewealth.co`
  (plus the `*.vercel.app` alias). `navigatewealth.co` is registered on the
  Vercel team as an external domain but is **not attached to the project**.
- DNS for `navigatewealth.co` is hosted at the registrar
  (`ns1–ns4.digisource.net.za`), not Vercel. `www` is a CNAME into
  `vercel-dns.com` and works. The apex `A` record points at `204.69.207.1`, a
  registrar web-forwarding host, so every apex request is answered by the
  registrar's forwarder — with whatever status code and target it chooses —
  and never reaches Vercel or `vercel.json`.

To make the apex behave as designed, both steps are needed and both are
dashboard/registrar changes, not code:

1. Vercel → Project `navigate-wealth` → **Settings → Domains → Add**
   `navigatewealth.co`. When Vercel asks, choose **"Add navigatewealth.co"**
   (serve it), _not_ "Redirect to www.navigatewealth.co". Vercel then shows the
   `A` record it expects.
2. At the registrar's DNS panel for `navigatewealth.co`, delete the web
   forwarding rule and replace the apex `A` record with the address Vercel shows
   (`76.76.21.21` at the time of writing). Leave the `www` CNAME alone.

Once DNS has propagated, Vercel issues the apex certificate automatically and
`vercel.json` takes over: `/` and every non-article path 301 to `www`, article
paths are served on the apex.

To check the apex is set up correctly:

```bash
# The apex must resolve to Vercel, not to the registrar's forwarder.
dig +short navigatewealth.co A

# Article path: must be 200 on the apex, with NO redirect to www.
curl -sSI "https://navigatewealth.co/resources/article/<a-published-slug>" | head -1

# Everything else: must be a single 301 straight to the canonical www host.
curl -sSI "https://navigatewealth.co/about" | grep -iE "^(HTTP|location:)"

# The redirects block is live at all (this one is served by Vercel today):
curl -sSI "https://www.navigatewealth.co/resources/article/holiday-scams-fake-deals-and-banking-fraud-how-to-protect-yourself-this-easter" | grep -iE "^(HTTP|location:)"
```

Article pages served from the apex carry a canonical tag pointing at the `www`
URL (`ArticleDetailPage` builds it from `SITE_ORIGIN`), and the sitemap only
lists `www`, so serving both hosts does not split indexing. The apex also
registers no service worker and exposes no manifest
(`src/utils/pwa/escapeHost.ts`), so it can never become an installable origin of
its own — which would recreate the capture problem on a second app.

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
