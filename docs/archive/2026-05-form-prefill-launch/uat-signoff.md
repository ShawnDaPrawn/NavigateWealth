> **ARCHIVED — completed launch record.** Form Prefill Tier A launched
> 2026-05-23. Kept as evidence, not as guidance. Day-to-day operations are in
> [`../../runbooks/form-prefill.md`](../../runbooks/form-prefill.md).

---

# Form Prefill — Verification Checklist

No formal adviser sign-off required. Use this checklist after deploy + frontend ship.

## Prerequisites

- Edge Function deployed: `npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .`
- Expanded API smoke green: `npm run form-prefill:smoke` (all 6 formIds + audit)
- Frontend built and deployed: `npm run build` → deploy `dist/` to production hosting
- Test client with profile + client keys in `e2e/.env.local` (`E2E_FNA_CLIENT_ID`; admin creds for Playwright)

## Engineering verification (automated)

| Check                                                                             | Result                                  | Date       |
| --------------------------------------------------------------------------------- | --------------------------------------- | ---------- |
| Expanded `/prefill/*` smoke (6 resolve + audit + apply-audit + `/form-templates`) | PASS                                    | 2026-05-23 |
| `npm test` — form-prefill + esign-prefill suites                                  | PASS (305 tests)                        | 2026-05-23 |
| Client JWT → `POST /prefill/resolve` returns 403                                  | PASS (integration test)                 | 2026-05-23 |
| Pre-launch rollback drill for the Medical legacy path                             | PASS (build + gate)                     | 2026-05-23 |
| Auto-populate adapter parity tests                                                | PASS                                    | 2026-05-23 |
| `npm run build` with prefill enabled                                              | PASS                                    | 2026-05-23 |
| Playwright on production (`PLAYWRIGHT_BASE_URL=https://www.navigatewealth.co`)    | PASS (5/5 incl. PDF template deep link) | 2026-05-23 |
| Client mode hides drawer prefill controls                                         | PASS (unit test)                        | 2026-05-23 |

## Tier A — Internal FNA prefill (browser walkthrough)

Legend: ☑ = verified (manual or automated). Playwright = `npm run form-prefill:e2e` with `E2E_ADMIN_*`.

| #   | Scenario                           | Expected                                            | Pass                                                             |
| --- | ---------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Retirement Step 1 — review → apply | Age/income populate; no silent overwrite after skip | ☑ drawer preview (Playwright); full Step 1 apply optional        |
| 2   | Risk Step 1 — skip prefill         | Existing cover not silently overwritten             | ☑ Playwright + `Step1InformationGathering.prefill-guard.test.ts` |
| 3   | Medical Step 1 — review → apply    | Age, spouse, medical keys via review                | ☑ Playwright (field visible after apply/skip)                    |
| 4   | Tax Step 1                         | Age, marital, dependants via review                 | ☐ optional spot-check                                            |
| 5   | Estate FNA                         | Family info via review                              | ☐ optional spot-check                                            |
| 6   | Investment INA                     | Overview fields via review                          | ☐ optional spot-check                                            |
| 7   | Conflict handling                  | Conflict unchecked; overwrite checkbox works        | ☐ optional spot-check                                            |
| 8   | Empty profile                      | Empty-state + profile edit link                     | ☐ optional spot-check                                            |
| 9   | AuthZ                              | Client JWT → 403                                    | ☑ (automated)                                                    |
| 10  | Intake accept                      | Prefill preview on accept path                      | ☐ optional (`FNAIntakeQueue` + `PrefillReviewModal` landed)      |
| 11  | Client drawer                      | Prefill FNA data + Prefill history visible          | ☑ Playwright                                                     |

Run Playwright (requires approved admin — UAT FNA adviser alone may not reach `/admin`):

```bash
# Local dev server
npm run dev
npm run form-prefill:e2e

# Production (recommended sign-off path)
PLAYWRIGHT_BASE_URL=https://www.navigatewealth.co npm run form-prefill:e2e
```

Credentials: copy `e2e/.env.example` → `e2e/.env.local` and set `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_FNA_CLIENT_ID`.

## Tier B — External PDF templates

| #   | Scenario         | Expected                                                                 | Pass                      |
| --- | ---------------- | ------------------------------------------------------------------------ | ------------------------- |
| 12  | Client picker    | Resources → Tools → Form Templates; client pre-selected from drawer link | ☑ Playwright (2026-05-23) |
| 13  | Template preview | Mapped fields reflect template (not retirement form)                     | ☐                         |
| 14  | Fill + attach    | Filled PDF downloads; document on client record                          | ☐                         |

Migrate legacy KV templates (if any exist):

```bash
node scripts/migrate-form-templates-to-storage.mjs --dry-run
node scripts/migrate-form-templates-to-storage.mjs --delete-kv-after
```

After migration, set Edge Function secret `FORM_TEMPLATE_ALLOW_KV_FALLBACK=false`.

## Rollback

The rollout flag and legacy silent-fill path were retired after production launch. Revert the
form-prefill rollout cleanup and redeploy if the launched UI must be rolled back.

## Support runbook

See [`docs/runbooks/form-prefill.md`](../../runbooks/form-prefill.md).
