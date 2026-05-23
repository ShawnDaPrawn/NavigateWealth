# Form Prefill — Support Runbook

Operational guide for advisers and engineering when unified form prefill misbehaves.

## Quick checks

| Symptom | Action |
|---------|--------|
| `/prefill/resolve` returns 404 | Redeploy Edge Function: `npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .` |
| Empty matches in review modal | Check client profile keys listed in `PREFILL_PROFILE_HINTS`; use profile edit link in banner/modal |
| Wrong proposed value | Compare source badge in review modal (profile vs client_keys vs policies vs derived) |
| Rate limit 429 on resolve | Wait 1 hour or clear KV key `rate_limit:form-prefill:resolve:{userId}` (service role) |
| Client JWT can prefill | Should return 403 — verify `requirePrefillUser` on route; client role must not pass |
| Rollback to legacy silent fill | Set `VITE_FORM_PREFILL_ENABLED=false`, rebuild frontend; Medical Step 1 uses legacy API fill when flag off |
| Prefill audit empty | Audit rows written only after Apply in wizard or review modal (`POST /prefill/apply-audit`) |
| PDF template fill fails | Confirm template PDF in Storage path on record; legacy KV `:file` base64 still supported as fallback |
| PDF attach failed | Storage bucket `make-91ed8379-documents` permissions; see `form-template-document.ts` |

## Access model

- **Platform-wide:** any authenticated adviser/admin may prefill any client.
- Clients may only hit resolve for their own `clientId` (normally blocked entirely by `requirePrefillUser`).
- Future assignment scoping is a one-file change in `assertPrefillClientAccess`.

## Verification commands

```bash
npm run form-prefill:smoke
npm test -- form-prefill
npx playwright test e2e/form-prefill-smoke.spec.ts --project=desktop-chromium
node scripts/migrate-form-templates-to-storage.mjs --dry-run
```

Smoke requires `e2e/.env.local` with `E2E_FNA_ADVISER_*` and `E2E_FNA_CLIENT_ID`.

Post-deploy: CI runs `form-prefill:smoke` after Edge Function deploy when `E2E_FNA_*` secrets are configured (non-blocking).

## Audit retention

Prefill apply events are stored in KV as `form_prefill_audit:{clientId}:{timestamp}`. v1 has **no auto-purge**; treat as 7-year retention policy for compliance planning. Query via `GET /prefill/audit/:clientId` (adviser auth).

## External PDF templates (Tier B)

- Upload writes PDF bytes to Supabase Storage (`form-templates/{id}/…`); metadata in KV.
- Fill supports text, checkbox, radio, and dropdown fields where pdf-lib exposes them.
- Limitations: no scanned PDFs, no DOCX in v1, no silent overwrite in e-sign packets.
- Legacy KV `:file` fallback is enabled by default; run `npm run form-prefill:migrate-templates -- --delete-kv-after` then set Edge Function env `FORM_TEMPLATE_ALLOW_KV_FALLBACK=false`.

## Related docs

- UAT matrix: `docs/form-prefill-uat-signoff.md`
- Launch plan: `docs/form-prefill-production-launch-plan.md`
- E-sign tokens: `docs/compliance/form-prefill-esign-tokens.md`
- Status ledger: `docs/PRODUCTION-READINESS.md` §10a
