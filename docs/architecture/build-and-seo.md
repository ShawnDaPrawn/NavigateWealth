# Build Pipeline, Environment and Feature Flags

**What this is.** What `npm run build` actually does, how environment variables
are resolved at build and at runtime, and how feature flags are read. Read this
before changing the build, adding an environment variable, or touching SEO output.

Day-to-day SEO operations — publishing, deploy hooks, recurring checks — are in
[`../runbooks/seo.md`](../runbooks/seo.md).

## The build pipeline

The production build does more than compile the SPA:

```bash
npm run build
```

Build sequence:

1. `scripts/seo/generate-seo-files.mjs` generates `sitemap.xml`, `robots.txt`, and SEO route data.
2. `vite build` compiles the SPA into `dist/`.
3. `scripts/seo/apply-static-seo.mjs` prerenders route-level `<head>` metadata and crawler-friendly static `<noscript>` body content.
4. `scripts/seo/verify-seo-build.mjs` validates the generated output.

SEO-related environment variables:

| Variable                                                                     | Effect                                                                                                                                                |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SITE_URL` or `VITE_SITE_URL`                                                | Base site URL used by SEO scripts. Defaults to the production site when unset.                                                                        |
| `GOOGLE_SITE_VERIFICATION` or `VITE_GOOGLE_SITE_VERIFICATION`                | Injects a Google Search Console verification meta tag into generated pages.                                                                           |
| `SEO_REQUIRE_ARTICLES`                                                       | `1`/`true` hard-fails if article fetch fails; `0`/`false` forces lenient behavior. When unset, CI/Vercel are strict and local development is lenient. |
| `SUPABASE_FUNCTIONS_BASE_URL`                                                | Allows SEO scripts to fetch published article/resource data from a specific Edge Function base URL.                                                   |
| `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY`, or `VITE_SUPABASE_ANON_KEY` | Anon key used by build-time article/resource fetches when needed.                                                                                     |

To verify Google Search Console:

1. Set `GOOGLE_SITE_VERIFICATION` in Vercel.
2. Redeploy.
3. Complete verification in Search Console.
4. Submit `https://www.navigatewealth.co/sitemap.xml`.

## Environment variable model

`.env.example` documents the variables the code reads. The major groups are:

| Group                  | Examples                                                                                                              | Where they belong                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Frontend public values | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`                                                        | Vercel/project build environment and optional `.env.local`. Must be non-secret. |
| Build and SEO          | `SITE_URL`, `SEO_REQUIRE_ARTICLES`, `GOOGLE_SITE_VERIFICATION`, `SUPABASE_FUNCTIONS_BASE_URL`                         | Local shell, Vercel build env, or CI.                                           |
| Edge Function secrets  | `SUPABASE_SERVICE_ROLE_KEY`, `NW_ALLOWED_ORIGINS`, `SUPER_ADMIN_PASSWORD`, `CRON_SECRET`, provider/API keys           | Supabase Edge Function secrets, not browser env.                                |
| AI and integrations    | `OPENAI_API_KEY`, `NW_GOOGLE_AI_API_KEY`, `LINKEDIN_CLIENT_SECRET`, `HONEYCOMB_API_KEY`, `NW_OPENCLAW_GATEWAY_SECRET` | Supabase secrets or integration host secrets, depending on consumer.            |
| Provider portal worker | `NW_API_BASE`, `NW_API_AUTH_TOKEN`, `NW_PORTAL_WORKER_SECRET`, `NW_PROVIDER_*`, `NW_PLAYWRIGHT_*`                     | Worker host, local debugging shell, or GitHub Actions.                          |
| E2E and smoke tests    | `E2E_FNA_ADVISER_EMAIL`, `E2E_FNA_ADVISER_PASSWORD`, `E2E_FNA_CLIENT_ID`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`             | Local ignored env files or GitHub Actions secrets.                              |

## Feature flags

Frontend Vite rollout flags for FNA intake and form prefill have been removed after production launch; those product paths are always on.

Edge-side FNA intake storage flags also exist:

| Secret                  | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `FNA_INTAKE_DUAL_WRITE` | Mirrors writes during KV to Postgres migration/cutover windows.  |
| `FNA_INTAKE_READ_FROM`  | Selects canonical read source, usually `postgres` after cutover. |
