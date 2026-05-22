# FNA Intake — Production Launch Checklist

Execute after Gates 0–4 pass (see `docs/PRODUCTION-READINESS.md` Section 0).

## Pre-launch (T-1)

1. [ ] Merge `main` includes Postgres migration + intake launch commits
2. [ ] Apply migration on production Supabase:
   ```bash
   npx supabase db push --project-ref vpjmdsltwrnpefzcgdmz
   ```
3. [ ] Enable dual-write on Edge Function secrets:
   - `FNA_INTAKE_DUAL_WRITE=true`
   - `FNA_INTAKE_READ_FROM=kv`
4. [ ] Deploy Edge Function:
   ```bash
   npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .
   ```
5. [ ] Run backfill (if KV sessions exist):
   ```bash
   node scripts/fna-intake-backfill.mjs
   ```
6. [ ] Switch reads to Postgres after verification:
   - `FNA_INTAKE_READ_FROM=postgres`
7. [ ] Staging UAT sign-off completed — `docs/fna-intake-uat-signoff.md`
8. [ ] Legal consent sign-off recorded

## Launch (T-0)

1. [ ] Deploy frontend from `main` to Vercel production
2. [ ] Set **`VITE_FNA_INTAKE_ENABLED=true`** on production (all-at-once rollout)
3. [ ] After 24h clean operation: set `FNA_INTAKE_DUAL_WRITE=false` (Postgres-only writes)

## Post-deploy smoke (T+0)

- [ ] Client: open service dashboard → intake hub loads
- [ ] Client: start draft on one domain (smoke only — optional discard)
- [ ] Adviser: FNA Intake Queue visible in Client Management
- [ ] Client with **published** FNA still sees results view
- [ ] Monitor Edge Function logs for `fna-intake-*` errors (30 min)

## Rollback

1. Set `VITE_FNA_INTAKE_ENABLED=false` on Vercel production
2. Redeploy frontend — clients fall back to `ClientFNAView` for published results
3. Intake API remains available but UI hidden; no data loss if Postgres canonical

## Monitoring

Watch Supabase Edge Function logs for:

- `fna-intake-service` — submit/accept failures
- `fna-intake-pg-repo` — shadow write failures during dual-write window
- Rate limit spikes — `fna-intake-rate-limit`

Alert on sustained 5xx or accept failure rate > baseline.
