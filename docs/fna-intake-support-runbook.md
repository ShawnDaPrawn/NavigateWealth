# FNA Intake — Adviser Support Runbook

## Overview

Client-led FNA intake lets clients complete Step 1 discovery in the portal. Advisers review submissions in **Client Management → FNA Intake Queue**, accept to continue at Step 2 in the domain wizard, and publish formal results as usual.

## Adviser workflow

1. Open **Client Management** — the intake queue badge shows pending submissions.
2. Click a queue row to open the client drawer or use **Accept** to hand off to Step 2.
3. **Accept** creates the same draft record as admin-led FNA create; the wizard opens at Step 2 with client answers pre-filled.
4. Complete calculation, review, and **publish** — client sees published results in their service dashboard.

## Request more information

- From the queue, use **Request info** on a submitted intake.
- Client status returns to `client_draft`; they receive an inbox notification.
- Client edits and resubmits; intake re-enters the queue.

## Troubleshooting

| Symptom                                       | Likely cause                                  | Action                                               |
| --------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| Queue empty but client says they submitted    | Adviser not assigned; client batch-status lag | Refresh queue; verify client session in admin drawer |
| Accept fails / 403                            | Non-real JWT or wrong role                    | Re-login as adviser/admin                            |
| Step 2 prefill incomplete (investment/estate) | Bespoke client subset vs full admin Step 1    | Manually complete missing fields; log defect         |
| Accept twice creates duplicate concern        | Postgres accept uses atomic claim             | Second accept is idempotent — same `linkedFnaId`     |
| Client cannot see intake UI                   | Frontend deploy or auth/session issue         | Confirm latest frontend is deployed and re-login     |

## Escalation

- Edge Function logs: filter `fna-intake-service`, `fna-intake-pg-repo`, `fna-intake-notifications`.
- Postgres shadow-write warnings during dual-write: safe if KV write succeeded; investigate if persistent.
- Re-deploy after backend fix: `npx supabase functions deploy make-server-91ed8379 --project-ref vpjmdsltwrnpefzcgdmz --use-api --workdir .`
