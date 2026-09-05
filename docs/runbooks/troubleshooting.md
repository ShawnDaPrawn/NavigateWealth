# Troubleshooting

**What this is.** First things to check for symptoms that have come up before.
If a symptom here turns into a recurring incident, it earns its own runbook; if
it turns into an outage, it earns an entry in [`../INCIDENTS.md`](../INCIDENTS.md).

| Symptom                                    | Things to check                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Login bounces back to login                | Preserve the single auth hydration pipeline; check Supabase session state, `AuthContext`, `loadUserProfile`, and auth regression tests.     |
| Browser says "Network error" for API calls | Check the Edge Function URL, `NW_ALLOWED_ORIGINS`, deployment status, request IDs, and Supabase function logs.                              |
| Build fails while fetching articles        | Set or review `SEO_REQUIRE_ARTICLES`; local builds can be lenient, CI/Vercel are strict by default.                                         |
| Public route metadata looks wrong          | Check `seo-route-manifest.json`, SEO scripts, route manifest data, and `npm run seo:verify`.                                                |
| Provider automation stalls on OTP          | Use provider worker debug artifacts, traces, videos, and live screenshots; see `docs/architecture/provider-portal-worker.md`.               |
| Deno typecheck reports many errors         | Compare against `quality/baselines/deno-check-baseline`; the CI gate ratchets against the committed floor while the backlog is burned down. |
