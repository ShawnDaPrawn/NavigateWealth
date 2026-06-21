# FNA Intake — Production Launch Checklist

Execute after Gates 0–4 pass (see `docs/PRODUCTION-READINESS.md` Section 0).

## Pre-launch (T-1)

1. [x] Merge `main` includes Postgres migration + intake launch commits
2. [x] Apply migration on production Supabase:
   ```bash
   npx supabase db push --project-ref vpjmdsltwrnpefzcgdmz
   ```
   _(Applied 2026-05-23 via Supabase MCP — table `public.fna_intake_sessions` verified.)_
3. [x] Enable dual-write on Edge Function secrets:
   - `FNA_INTAKE_DUAL_WRITE=true`
   - ~~`FNA_INTAKE_READ_FROM=kv`~~ → switched to `postgres` (no KV sessions to backfill)
4. [x] Deploy Edge Function:
   ```bash
   npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .
   ```
5. [x] Run backfill (if KV sessions exist):
   ```bash
   node scripts/fna-intake-backfill.mjs
   ```
   _(Skipped — 0 KV intake sessions at cutover.)_
6. [x] Switch reads to Postgres after verification:
   - `FNA_INTAKE_READ_FROM=postgres`
7. [x] Staging UAT sign-off completed — `docs/fna-intake-uat-signoff.md` (automated API UAT, 2026-05-23)
8. [x] Legal consent sign-off recorded (engineering verification)

## Launch (T-0)

1. [x] Deploy frontend from `main` to Vercel production
2. [x] Launch client intake UI on production (all-at-once rollout)
3. [x] After 24h clean operation: set `FNA_INTAKE_DUAL_WRITE=false` (Postgres-only writes) — applied immediately after UAT (0 KV sessions)

## Post-deploy smoke (T+0)

- [ ] Client: open service dashboard → intake hub loads
- [ ] Client: start draft on one domain (smoke only — optional discard)
- [ ] Adviser: FNA Intake Queue visible in Client Management
- [ ] Client with **published** FNA still sees results view
- [ ] Monitor Edge Function logs for `fna-intake-*` errors (30 min)

## Rollback

1. Revert the frontend release that made client intake the default launched path
2. Redeploy frontend — `ClientFNAView` remains available for published results
3. Intake API remains available; no data loss if Postgres canonical

## Monitoring

Watch Supabase Edge Function logs for:

- `fna-intake-service` — submit/accept failures
- `fna-intake-pg-repo` — shadow write failures during dual-write window
- Rate limit spikes — `fna-intake-rate-limit`

Alert on sustained 5xx or accept failure rate > baseline.
