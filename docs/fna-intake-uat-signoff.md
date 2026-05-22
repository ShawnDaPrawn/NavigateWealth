# FNA Intake — Staging UAT Sign-off

Complete on **staging** with dedicated test client + assigned adviser before production launch.

**Environment:** `VITE_FNA_INTAKE_ENABLED=true`, Edge Function deployed, Postgres migration applied, `FNA_INTAKE_READ_FROM=postgres` after backfill.

## Sign-off record

| Field | Value |
|-------|-------|
| Date | |
| Tester(s) | |
| Staging URL | |
| Edge Function deploy ref | |
| Migration | `20260520000001_fna_intake_sessions.sql` |

## Per-domain matrix

Mark **Pass / Fail / N/A** for each domain: risk, medical, retirement, investment, tax, estate.

| Step | risk | medical | retirement | investment | tax | estate |
|------|------|---------|------------|------------|-----|--------|
| Client draft → submit (consent) | | | | | | |
| Adviser queue visible | | | | | | |
| Accept → Step 2 prefill | | | | | | |
| Publish → client results | | | | | | |
| Request-info → edit → resubmit | | | | | | |
| Client + adviser notifications on submit | | | | | | |
| Read-only submission view | | | | | | |

## Global checks

- [ ] Feature flag **off**: legacy `ClientFNAView` still works on service dashboards
- [ ] Feature flag **on**: hub, wizard, queue visible
- [ ] Legal consent copy reviewed (see compliance sign-off below)
- [ ] No P0/P1 defects open

## Compliance sign-off

| Item | Approver | Date |
|------|----------|------|
| `FNA_INTAKE_CONSENT_TEXT` / dialog copy | | |

## Defects found

| ID | Severity | Domain | Description | Status |
|----|----------|--------|-------------|--------|
| | | | | |

**Launch approved:** ☐ Yes ☐ No — approver: _______________
