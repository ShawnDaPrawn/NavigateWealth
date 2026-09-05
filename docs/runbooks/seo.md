# SEO Operations Runbook

How the Navigate Wealth SEO pipeline works in production and the one-time /
recurring operational steps that keep it healthy. Code reference: the build
pipeline is `generate-seo-files.mjs → vite build → apply-static-seo.mjs →
verify-seo-build.mjs` (see `package.json` `build`).

## One-time setup

### 1. Vercel Deploy Hook (required — new articles depend on it)

Publishing, unpublishing, archiving, deleting, or editing a **published**
article triggers a site rebuild via a Vercel Deploy Hook
(`src/supabase/functions/server/site-rebuild-trigger.ts`), so the sitemap,
prerendered article pages, and edge route manifest stay current. Until the
rebuild finishes, a brand-new article URL still works — the edge middleware
serves the SPA shell and the article renders client-side — but it is not yet
prerendered or in the sitemap.

1. Vercel → Project → **Settings → Git → Deploy Hooks** → create a hook named
   e.g. `article-publish`, branch `main`. Copy the URL.
2. Store it as a Supabase secret and redeploy the edge function:

   ```bash
   npx supabase secrets set VERCEL_DEPLOY_HOOK_URL="https://api.vercel.com/v1/integrations/deploy/..." --project-ref vpjmdsltwrnpefzcgdmz
   npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .
   ```

3. Verify: publish a test article in the admin → a Vercel build should start
   within ~1 minute (the trigger coalesces repeat fires within 30s). The
   function logs `Site rebuild triggered (article_published:<id>)`.

When the secret is unset the trigger is a silent no-op — nothing breaks, but
article SEO artifacts only refresh on the next code deploy.

### 2. Google Search Console verification

Set `GOOGLE_SITE_VERIFICATION` (the content value of the HTML-tag
verification meta) as a Vercel environment variable. The build injects it into
every prerendered head and **fails** if it is set but not injected
(`verify-seo-build.mjs`). If it is not set, verify ownership another way —
then still set it so ownership survives DNS/provider changes.

### 3. Organization facts (`src/components/seo/organization.json`)

Single source of truth for the business schema on every page (name, legal
name, Pretoria address, phone, email, social links). Edit this file — not the
schema factories — when details change. Worth adding when available:

- `geo` (latitude/longitude of the Route 21 Business Park office) and
  `hasMap` (Google Maps share URL) for local-search relevance.
- A **Google Business Profile** listing linked to the same NAP
  (name/address/phone) data is the single highest-impact local-SEO action
  remaining.

## Content hygiene

- **Duplicate articles:** `holiday-scams-fake-deals-and-banking-fraud-how-to-protect-yourself`
  and `…-this-easter` are near-duplicates. Either unpublish one or set the
  **Canonical URL** field in the ArticleEditor (maps to `seo_canonical_url`)
  on the duplicate to point at the survivor.
- Article excerpts become meta descriptions (clamped to 160 chars at build
  time) — write them as search snippets.
- FAQ content lives in `src/components/seo/faqs.json` and renders visibly on
  the home + service pages AND as FAQPage JSON-LD. Keep answers current;
  never add JSON-LD-only content (Google requires visibility).

## Search Console routine (weekly for the first month, then monthly)

1. Submit `https://www.navigatewealth.co/sitemap.xml` once; confirm it stays
   "Success".
2. **Coverage/Pages report:** watch for "Crawled – currently not indexed" on
   core pages and for 404s under `/resources/article/` (should disappear now
   that unknown slugs serve the SPA shell and rebuilds are automatic).
3. **Enhancements:** FAQ and Breadcrumb rich-result reports should populate
   within a few weeks. Spot-check with the
   [Rich Results Test](https://search.google.com/test/rich-results) on one
   service page (FAQPage + FinancialService) and one article (Article).
4. After deploys that change social metadata, re-scrape key URLs with the
   [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) and
   [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
   (they cache old OG images aggressively).

## How the pieces fit (for future maintainers)

| Concern                                   | Where                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Page titles/descriptions (client)         | `src/components/seo/seo-config.ts`                                                                             |
| Page titles/descriptions (prerendered)    | `scripts/seo-static-data.mjs` (`publicSeoRoutes`) — a parity test fails if titles drift from the client config |
| Organization / business facts             | `src/components/seo/organization.json`                                                                         |
| FAQ content                               | `src/components/seo/faqs.json`                                                                                 |
| Sitemap + robots                          | generated by `scripts/generate-seo-files.mjs` at build                                                         |
| Prerendered heads + visible static bodies | `scripts/apply-static-seo.mjs`                                                                                 |
| Build-time SEO assertions (hard gate)     | `scripts/verify-seo-build.mjs`                                                                                 |
| Hard 404s / article fallthrough           | `middleware.ts` + `src/middleware/route-policy.ts`                                                             |
| Rebuild-on-publish                        | `src/supabase/functions/server/site-rebuild-trigger.ts`                                                        |
| Social/OG image (1200×630)                | `public/brand-assets/navigate-wealth-og.png`, regenerate with `node ./scripts/generate-og-image.mjs`           |
