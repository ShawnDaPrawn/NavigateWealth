# Scheduled jobs (pg_cron) — how to tell whether they are actually working

Audited 2026-08-25 against production (`vpjmdsltwrnpefzcgdmz`). **13 of the 15
active jobs were not doing their work** — silently, and several had never worked
at all. Only the two `publications` jobs were confirmed healthy.

This runbook exists because nothing in the system says so: a scheduled job that
fails produces no user-visible error, no alert, and — critically — is still
recorded as `succeeded` by pg_cron.

## The trap that hides all of this

`cron.job_run_details.status = 'succeeded'` means **the SQL statement ran**. It
does not mean the HTTP call succeeded. Every one of these jobs is a
`net.http_post(...)`, which _enqueues_ a request and returns a row id
immediately. The job is marked succeeded (`return_message = '1 row'`) whether
the eventual response is 200, 401, 404, or never sent at all.

So there are three independent failure planes, and you must check all three:

| plane                                 | where the failure shows up                   | how to see it |
| ------------------------------------- | -------------------------------------------- | ------------- |
| 1. SQL never enqueued the request     | `cron.job_run_details.status <> 'succeeded'` | query A       |
| 2. request sent, function rejected it | `function_edge_logs` status 401/404          | query C       |
| 3. request sent, handler errored      | `function_edge_logs` status 5xx              | query C       |

A job that is green in plane 1 can be entirely dead in plane 2. That is the
normal case here, not the exception.

## Query A — did the SQL even run?

```sql
select j.jobid, j.jobname, j.schedule, j.active,
       count(d.runid)                                        as runs_7d,
       count(*) filter (where d.status = 'succeeded')         as succeeded,
       count(*) filter (where d.status <> 'succeeded')        as not_succeeded,
       max(d.start_time)                                      as last_run,
       (array_agg(d.return_message order by d.start_time desc))[1] as last_message
from cron.job j
left join cron.job_run_details d
  on d.jobid = j.jobid and d.start_time > now() - interval '7 days'
group by j.jobid, j.jobname, j.schedule, j.active
order by j.jobid;
```

`not_succeeded > 0` with `ERROR: Quote command returned error` in
`last_message` means `net.http_post` could not build the request — in practice,
a malformed URL. See "Placeholders that were never substituted" below.

## Query B — read the job commands WITHOUT dumping secrets

`cron.job.command` contains bearer tokens in plaintext. Never `select command`
raw into a transcript, a file, or a PR. Redact first:

```sql
select jobid, schedule, jobname, active,
       regexp_replace(command, '(Bearer\s+)<?[A-Za-z0-9._\-]*>?', '\1<REDACTED>', 'g')
         as command_redacted
from cron.job
order by jobid;
```

**The `<?` and `>?` are load-bearing — do not drop them.** The obvious version of
this regex is `(Bearer\s+)[A-Za-z0-9._-]+`, which anchors on token characters and
therefore skips a token wrapped in literal angle brackets (`Bearer <eyJ...>`).
Three of the rows in this project have exactly that shape, so the obvious regex
returns the full service-role token on the very first run — and "check the output
before trusting it" is no protection, because by then the token is already in the
terminal, the query history, and whatever transcript is recording the session.
A redaction pattern has to be right before it is run, not after.

Verified against all 15 rows in this project on 2026-08-25: the bracket-aware
pattern leaks nothing, the obvious one leaks a JWT from 2 of the 15. Re-run this
self-check — which returns counts, never text — before trusting any redaction
pattern you have edited:

```sql
with redacted as (
  select jobid,
         regexp_replace(command, '(Bearer\s+)<?[A-Za-z0-9._\-]*>?', '\1<REDACTED>', 'g')
           as candidate
  from cron.job
)
select count(*) as jobs_checked,
       count(*) filter (where position('eyJ'       in candidate) > 0) as jwt_leaks,
       count(*) filter (where position('sb_secret' in candidate) > 0) as secret_key_leaks
from redacted;
```

Both leak counts must be `0`.

To ask _which role_ a job authenticates as without revealing the token, decode
only the JWT payload (the payload is not the secret; the signature is):

```sql
with tok as (
  select jobid, jobname,
         (regexp_match(command, 'Bearer\s+<?([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)\.'))[1]
           as head_payload
  from cron.job
)
select jobid, jobname,
       case when head_payload is null then 'NO_JWT_FOUND'
            else convert_from(decode(rpad(
                   replace(replace(split_part(head_payload,'.',2),'-','+'),'_','/'),
                   ((length(split_part(head_payload,'.',2))+3)/4)*4, '='), 'base64'), 'UTF8')
       end as jwt_payload_claims
from tok order by jobid;
```

## Query C — what did the function actually answer?

Run against the logs (Logs Explorer, or the same transport `npm run metrics`
uses). `function_edge_logs`, not `edge_logs` — see the metrics runbook.

```sql
select log_attributes['request.pathname']     as path,
       log_attributes['response.status_code'] as status,
       count()                                as n,
       max(timestamp)                         as last_seen
from logs
where source = 'function_edge_logs'
  and position(log_attributes['request.pathname'], '/cron/') > 0
group by path, status
order by path, status
```

Widen the `where` clause with the non-`/cron/` targets too — several scheduled
endpoints do not carry `/cron/` in their path (`tasks-digest/send-overdue`,
`calendar-digest/send-daily`, `calendar-digest/send-birthdays`,
`auto-content/process-due`). Read the target list out of `cron.job` rather than
guessing it.

## What the 2026-08-25 audit found

| jobid | job                                      | schedule              | state     | root cause                                                                   |
| ----- | ---------------------------------------- | --------------------- | --------- | ---------------------------------------------------------------------------- |
| 8     | `publications-process-scheduled`         | `* * * * *`           | **works** | — (10,080/10,080 runs, HTTP 200)                                             |
| 24    | `publications-process-notification-jobs` | `30 seconds`          | **works** | — (20,142/20,142 runs, HTTP 200)                                             |
| 1     | `process-auto-content-pipelines`         | `*/15 * * * *`        | dead      | malformed URL — 672 SQL failures/7d, never worked                            |
| 3     | `process-scheduled-articles`             | `*/5 * * * *`         | dead      | malformed URL — 2,016 SQL failures/7d, never worked                          |
| 6     | `overdue-tasks-daily-digest`             | `0 4 * * 1-5`         | dead      | malformed URL — 5 SQL failures/7d                                            |
| 7     | `esign-expiry-sweep`                     | `0 */6 * * *`         | dead      | HTTP 401 (observed)                                                          |
| 9     | `auto-content-process-due`               | `0 4,8,12,16 * * 1-5` | dead      | HTTP 401 (observed)                                                          |
| 16    | `calendar-daily-digest`                  | `0 4 * * 1-5`         | dead      | HTTP 401 (observed)                                                          |
| 10    | `client-profile-cleanup`                 | `0 22 * * 0`          | dead      | HTTP 401 (**inferred** — identical guard, last run outside the log window)   |
| 17    | `client-birthday-digest`                 | `0 5 * * 1-5`         | dead      | HTTP 404 (observed) — no handler                                             |
| 18    | `submissions-aging-alert`                | `0 6 * * 1-5`         | dead      | HTTP 404 (observed) — no handler                                             |
| 19    | `communication-group-recalc`             | `0 23 * * *`          | dead      | HTTP 404 (observed) — no handler                                             |
| 22    | `resource-zip-cleanup`                   | `0 2 * * *`           | dead      | HTTP 404 (observed) — no handler                                             |
| 20    | `kv-data-consistency-audit`              | `0 21 * * 0`          | dead      | HTTP 404 (**inferred** — no handler in code; weekly, outside the log window) |
| 21    | `weekly-business-summary`                | `0 14 * * 5`          | dead      | HTTP 404 (**inferred** — no handler in code; weekly, outside the log window) |

Ten of the thirteen failures are directly observed in `cron.job_run_details`
or `function_edge_logs`. The three marked _inferred_ are weekly jobs whose last
fire predates the 24-hour log retention window; for jobs 20 and 21 the target
path has no handler anywhere in the codebase, and for job 10 the handler exists
but is behind the same guard that returns 401 for every other caller.

Three distinct root causes, all silent.

### 1. Placeholders that were never substituted (plane 1 — never left the DB)

Three jobs carry literal template text in the URL, so `net.http_post` errors
before any request is made:

- `process-scheduled-articles` — `https://<YOUR_PRvpjmdsltwrnpefzcgdmz>.supabase.co/...`
  (the project ref was pasted _into the middle_ of `<YOUR_PROJECT_REF>`, and the
  anon key into the middle of `<YOUR_ANON_KEY>`). Runs every 5 minutes.
  **2,016 consecutive failures in 7 days. Zero successes, ever.**
- `process-auto-content-pipelines` — same shape, every 15 minutes.
  **672 consecutive failures in 7 days.**
- `overdue-tasks-daily-digest` — same shape, weekdays 04:00.

Note that job 3 would fail even with a well-formed URL: its target,
`publications/process-scheduled`, is behind `requireAdmin`, and the job sends an
**anon** key.

### 2. Targets that do not exist (plane 2 — HTTP 404)

Six jobs post to paths with no handler anywhere in the codebase. These are the
`/cron/*` routes that _do_ exist:

```text
/cron/cleanup   /cron/expiry-sweep   /cron/process-notification-jobs
/cron/process-scheduled   /cron/reminder-sweep   /cron/status
/cron/stuck-alert-sweep   /cron/synthetic-probe
```

and these are the scheduled targets with nothing behind them:

| job                          | target                                  | grep hits |
| ---------------------------- | --------------------------------------- | --------- |
| `client-birthday-digest`     | `calendar-digest/send-birthdays`        | 0         |
| `submissions-aging-alert`    | `submissions/cron/aging-alert`          | 0         |
| `communication-group-recalc` | `communication/cron/recalculate-groups` | 0         |
| `resource-zip-cleanup`       | `resources/cron/zip-cleanup`            | 0         |
| `kv-data-consistency-audit`  | `clients/cron/consistency-audit`        | 0         |
| `weekly-business-summary`    | `reporting/cron/weekly-summary`         | 0         |

Either the handler was removed without retiring the schedule, or the schedule
was created ahead of a handler that was never written. Both are invisible
without query C.

**The drift runs both ways.** `/cron/reminder-sweep`, `/cron/stuck-alert-sweep`
and `/cron/synthetic-probe` are implemented and mounted but have no scheduled
job pointing at them — work that was built to run on a timer and never wired up.

### 3. Cron auth is rejected (plane 2 — HTTP 401)

`esign-expiry-sweep`, `calendar-daily-digest` and `auto-content-process-due`
send a genuine `service_role` JWT (confirmed by decoding the payload, query B)
and are answered **401**. `client-profile-cleanup` uses the same guard.

The guard they hit is a plain equality check:

```ts
// calendar-digest-routes.ts
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
if (serviceRoleKey && constantTimeEqual(token, serviceRoleKey)) return next();
return new Response('Unauthorized — cron auth required', { status: 401 });
```

`constantTimeEqual` was read and is correct (length check, XOR accumulate, no
early exit). So the comparison is sound and the conclusion is about the _values_:
**the `SUPABASE_SERVICE_ROLE_KEY` the function sees is not the same string the
cron rows send.**

The evidence for that is consistent across every route, and it is worth stating
precisely because it is inference from behaviour, not a direct read — Edge
Function secrets are not reachable from the Management API or MCP, so the value
cannot be compared directly:

- Every route whose **only** cron path is `token === SUPABASE_SERVICE_ROLE_KEY`
  returns 401 in production. No exceptions found.
- Every route that **works** works through a fallback that does not use that
  comparison:
  - `publications/cron/*` (10,080 + 20,142 runs in 7 days, all 200) matches a
    shared token from KV against an `x-publications-cron-auth` header, and its
    bearer is the **anon** key — so its service-role branch cannot be what
    passes.
  - `tasks-digest/send-overdue` returns 200/204 only from the **admin-JWT**
    fallback (frontend-triggered); its 04:00 cron never reaches the function at
    all (root cause 1).
- Therefore there is **no observed instance** of the service-role comparison
  succeeding in production.

To settle it (operator, needs dashboard access): compare
Edge Functions → Secrets → `SUPABASE_SERVICE_ROLE_KEY` against the token in the
cron rows. The likely causes are a key rotation that the cron rows never picked
up, or the project's move to the new API key format (this project has
`sb_publishable_…` issued alongside still-enabled legacy JWTs).

## Remediation shape (not yet applied — needs an operator decision)

Nothing here was changed. Each fix is a production write and two of the three
involve secrets, so they are listed rather than executed.

1. **Stop storing the service-role key in `cron.job.command`.** Eleven jobs hold it
   in plaintext, readable by anything that can read `cron.job`. The publications
   jobs already show the right pattern — pull the secret at call time:
   ```sql
   'Authorization', 'Bearer ' || (select decrypted_secret
                                  from vault.decrypted_secrets
                                  where name = '<vault-secret-name>'
                                  order by created_at desc limit 1)
   ```
   Rotating the key then does not require rewriting every job, and the audit
   above (query B) stops being able to leak it.
2. **Fix or retire the six 404 jobs.** Retiring is `cron.unschedule(jobname)`;
   leaving them active costs a wasted request per fire and hides real signal.
3. **Fix the three malformed URLs**, or delete them if superseded — note that
   `process-scheduled-articles` (jobid 3) and `publications-process-scheduled`
   (jobid 8) target the same work, and only the latter runs. Job 1 vs job 9 are
   the same pair for auto-content. The dead members of both pairs look like
   earlier attempts that were replaced but never unscheduled.
4. **Re-point cron auth at a mechanism that is verifiable.** The KV/vault shared
   token used by publications is the only cron auth in this codebase with a
   proven success record.

## Do this after any change to a scheduled job

Run query A **and** query C. **Query A alone cannot establish that a job works** —
that is the trap this whole runbook is about. `net.http_post` is asynchronous, so
query A stays green for a 401, a 404, or a 5xx. Only query C shows what the
function actually answered. A change is verified when query C shows a 2xx for the
job's target path, at a timestamp matching the schedule.
