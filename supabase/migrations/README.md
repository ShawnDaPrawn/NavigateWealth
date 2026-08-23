# Migrations — repo vs. production reconciliation

> **Verified against the production project `vpjmdsltwrnpefzcgdmz` on
> 2026-08-23** by listing applied migrations and tables directly (read-only).
> This file exists because the folder does **not** describe production, and a
> migrations folder that silently lies is worse than an empty one: schema that
> only exists in the dashboard cannot be reviewed, rolled back, or reproduced in
> a staging project.
>
> Tracked as **D2** in `docs/ARCHITECTURE-REMEDIATION-PLAN.md` and WS0.7 in
> `docs/REFACTORING-ROADMAP.md`.

## What is actually applied in production

Three migrations, and note that **none of the version stamps match the repo
filenames** — the two that landed were applied out-of-band, so the numbers
cannot be used to correlate them:

| Applied version | Name                       | Repo file                                   |
| --------------- | -------------------------- | ------------------------------------------- |
| 20260316213718  | `create_kv_table_91ed8379` | **none — no file exists**                   |
| 20260522225558  | `fna_intake_sessions`      | `20260520000001_fna_intake_sessions.sql`    |
| 20260821210412  | `atomic_auth_rate_limit`   | `20260821000001_atomic_auth_rate_limit.sql` |

## Drift, in both directions

**In the repo but NOT applied:**

- `20260420000001_esign_core_tables.sql` — **there are no `esign_*` tables in
  production.** All e-signature data lives in KV. This corrects the status
  ledger, which described these tables as landed with RLS.
  ⚠️ This file is a live hazard: a `supabase db push` would create the tables
  and, depending on what reads them, silently split e-sign state across two
  stores. **Decide deliberately — apply it (with a KV backfill and a read
  cutover, mirroring the FNA-intake track) or delete it.** It is left in place
  rather than deleted here because discarding another author's schema work is
  the owner's call, not an incidental one.
- `20260611000001_fna_intake_rls_draft_only.sql` — not in the applied list.
  This one tightens an RLS policy (SECURITY-AUDIT H-12: clients could UPDATE a
  session after submitting it). **Whether the policy is nonetheless present in
  production was not verified** — it may have been applied by hand. Check the
  live policy on `public.fna_intake_sessions` before assuming either way; if it
  is missing, this is an open security gap, not just bookkeeping.

**In production but NOT in the repo** — every one of these has RLS enabled
(verified), but none has a migration file:

| Table                                 | RLS | Rows at check |
| ------------------------------------- | --- | ------------- |
| `public.kv_store_91ed8379`            | ✅  | 9,486         |
| `public.personal_client_applications` | ✅  | 0             |
| `public.tasks`                        | ✅  | 0             |
| `public.clients`                      | ✅  | 0             |
| `public.reminders`                    | ✅  | 0             |
| `public.events`                       | ✅  | 0             |
| `public.fna_intake_sessions`          | ✅  | 22            |

## Why no migration files were generated here

Reconstructing DDL for the seven tables above from an introspection summary
would produce files that _look_ authoritative while quietly omitting indexes,
constraints, policies, triggers and defaults. A migration that misrepresents
production is the same failure this document exists to fix, one level deeper.

The correct way to close it is `supabase db pull` (or
`pg_dump --schema-only`) run against production by someone holding the
credentials, committed verbatim and reviewed. That is an operator step; it
cannot be done from an agent sandbox, whose egress to `api.supabase.com` is
blocked.

## Reconciliation checklist

- [ ] `supabase db pull` against `vpjmdsltwrnpefzcgdmz`; commit the generated
      baseline so every applied object has a file.
- [ ] Confirm whether the H-12 `fna_intake_sessions` client-update RLS policy is
      live; apply `20260611000001` if it is not.
- [ ] Decide the fate of `20260420000001_esign_core_tables.sql` — apply with a
      backfill + read cutover, or delete.
- [ ] Once the folder matches, keep it matching: no schema change by dashboard.
