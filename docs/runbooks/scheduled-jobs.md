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

> **This table is the 2026-08-25 snapshot, not current state.** All six jobs
> that were repaired rather than retired have since been observed returning 2xx
> on their own schedules — see [Post-repair verification](#post-repair-verification-closed-2026-08-30).

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

**Corrected 2026-08-25 after the repair.** The original audit filed all four
401s under one cause. They are two.

`esign-expiry-sweep`, `calendar-daily-digest` and `client-profile-cleanup` hit a
guard comparing the bearer to `SUPABASE_SERVICE_ROLE_KEY`. `auto-content-process-due`
hit something else entirely: `auto-content-routes.ts` carried
`app.use('*', requireAdmin)`, so the whole module required an admin _user
session_. A scheduled job has none and never could — that route was not
cron-callable by design, and no amount of key-fixing would have helped.

The stronger measurement on the other three: each cron row's bearer is
**byte-identical to the Vault copy of the service-role key** — compared inside
SQL so nothing was printed:

```sql
with v as (select decrypted_secret k from vault.decrypted_secrets
           where name = 'navigatewealth_service_role_key' order by created_at desc limit 1)
select j.jobid, j.jobname,
       case when tok = v.k then 'MATCHES' else 'DIFFERENT' end
from (select jobid, jobname,
             (regexp_match(command, 'Bearer\s+<?([A-Za-z0-9._\-]+)>?'))[1] tok
      from cron.job) j cross join v order by j.jobid;
```

Eleven rows returned `MATCHES` at 219 characters. So the jobs were not sending a
wrong-role or truncated key — they were sending _a_ well-formed service-role key
that the function rejects. The Vault copy and the cron rows agree with each
other and disagree with the function, which points at a rotation that the
function picked up automatically and neither of the other two did.

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

**RESOLVED by replacing the mechanism, not the value** (2026-08-25). Chasing the
value was the wrong move: the mismatch cannot be confirmed from SQL, and it
would recur on the next rotation. Cron auth now uses a dedicated token in Vault,
verified through `public.verify_cron_auth_token` — a SECURITY DEFINER boolean
oracle, so the secret is compared inside Postgres and never enters the function.
See `src/supabase/functions/server/cron-auth.ts` and migrations
`20260825085409` / `20260825085435`.

That removes the dependency on an env var this side cannot read, takes the
service-role key out of `cron.job.command`, and makes rotation one
`vault.update_secret` with no job edits. The service-role env comparison is kept
as a second branch so an operator's manual `curl` still works.

If you still want to know what the function's `SUPABASE_SERVICE_ROLE_KEY` holds:
Edge Functions → Secrets in the dashboard is the only place it is readable. It
is no longer load-bearing for any scheduled job.

## Remediation shape (applied 2026-08-25/26 — one item outstanding, see below)

These four were written as proposals, not executed — each is a production write
and two of them involve secrets. **They were applied on 2026-08-25/26**, so read
them below as the record of what was done and why, with one exception.

Recommendation 2 was carried out by setting `active = false` on the seven dead
jobs rather than by `cron.unschedule`. That stops them firing but leaves five of
them holding the service-role key, which is the single outstanding production
write — see
[The retired jobs still hold the service-role key](#the-retired-jobs-held-the-service-role-key-closed-2026-09-01).

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

## The retired jobs held the service-role key (closed 2026-09-01)

Recommendation 1 above was applied to every **active** job: all eight now pull
the bearer from `vault.decrypted_secrets` at call time, and none carries a key
inline. Recommendation 2 was applied by setting `active = false` on the seven
dead jobs rather than by `cron.unschedule`.

That left a gap the deactivation did not close. `active = false` stops a job
firing; it does not touch `command`, so the row kept whatever credential it was
written with — this was the state until 2026-09-01:

| jobid | job                          | active | token                             |
| ----- | ---------------------------- | ------ | --------------------------------- |
| 18    | `submissions-aging-alert`    | false  | **live service-role key**, 219 ch |
| 19    | `communication-group-recalc` | false  | **live service-role key**, 219 ch |
| 20    | `kv-data-consistency-audit`  | false  | **live service-role key**, 219 ch |
| 21    | `weekly-business-summary`    | false  | **live service-role key**, 219 ch |
| 22    | `resource-zip-cleanup`       | false  | **live service-role key**, 219 ch |

Measured the same way as the original audit — compared inside SQL so the secret
is never printed, and cross-checked by decoding only the JWT payload's `role`
claim:

```sql
with v as (select decrypted_secret k from vault.decrypted_secrets
           where name = 'navigatewealth_service_role_key' order by created_at desc limit 1)
select j.jobid, j.jobname, j.active,
       case when j.tok = v.k then 'SERVICE ROLE KEY' else 'some other token' end
from (select jobid, jobname, active,
             (regexp_match(command, 'Bearer\s+<?([A-Za-z0-9._\-]+)>?'))[1] tok
      from cron.job) j cross join v
where j.active = false order by j.jobid;
```

All five return `SERVICE ROLE KEY` with `role: service_role`. The key is
**current**, not a rotated-out copy: it is byte-identical to what the vault
serves the active jobs today.

Jobs 1 and 3 are also inactive but are not part of this: job 1's bearer is the
literal 13-character `YOUR_ANON_KEY`, and job 3's is a 221-character string
where the anon key was pasted _into the middle_ of `<YOUR_ANON_KEY>` — neither
is a usable credential.

**Why this still matters when reading `cron.job` already requires DB access.**
Not because it grants an attacker something new inside the database — it does
not. Because it defeats the specific property recommendation 1 was written to
buy: _rotating the vault secret no longer rotates every copy._ Five plaintext
copies now sit outside the vault, in a table that lands in every backup and
snapshot, and a rotation would silently leave them valid.

**The fix was `cron.unschedule`, not another `UPDATE`.** These jobs were
retired; deleting the row removes the credential with it and leaves nothing to
re-audit. **Executed by the owner on 2026-09-01**, one named call per job rather
than the set-based form this section first suggested:

```sql
select cron.unschedule('process-auto-content-pipelines');  -- jobid 1
select cron.unschedule('process-scheduled-articles');      -- jobid 3
select cron.unschedule('submissions-aging-alert');         -- jobid 18
select cron.unschedule('communication-group-recalc');      -- jobid 19
select cron.unschedule('kv-data-consistency-audit');       -- jobid 20
select cron.unschedule('weekly-business-summary');         -- jobid 21
select cron.unschedule('resource-zip-cleanup');            -- jobid 22
```

Name the jobs; do not write `select cron.unschedule(jobname) from cron.job where
jobid in (…)`. That deletes rows from the table it is scanning, and a mistyped
`where` can match a live job. Seven named calls cannot over-match, and a reader
can see what each one does.

### Verified after

15 jobs down to **8 — all active, all pulling auth from
`vault.decrypted_secrets`, none holding the service-role key**:

```sql
with v as (select decrypted_secret k from vault.decrypted_secrets
           where name = 'navigatewealth_service_role_key' order by created_at desc limit 1)
select j.jobid, j.jobname, j.active,
       case when j.command like '%decrypted_secrets%' then 'vault' else 'INLINE' end as auth_source,
       exists (select 1 from regexp_matches(j.command, '(eyJ[A-Za-z0-9._\-]+)', 'g') m
               where m[1] = (select k from v)) as holds_service_role_key
from cron.job j order by j.jobid;
```

**Use that query, not the `Bearer\s+<?(…)>?` form above it.** The earlier regex
captures one token per command and silently missed job 3's, where the key had
been pasted _inside_ the `<YOUR_ANON_KEY>` placeholder so the match started at
`<`. This version scans every `eyJ…` token in the command and compares each
against the vault secret, so a second credential hiding later in the same
command cannot slip past.

Two surviving jobs (8 and 24) do still carry an inline JWT. It is the **anon**
key — public by design, already in the browser bundle — and both also pull their
real authorisation from the vault, so neither is an exposure. Distinguishing
that from the service-role case is exactly what the query above is for.

The surviving eight: 6 `overdue-tasks-daily-digest`, 7 `esign-expiry-sweep`,
8 `publications-process-scheduled`, 9 `auto-content-process-due`,
10 `client-profile-cleanup`, 16 `calendar-daily-digest`,
17 `client-birthday-digest`, 24 `publications-process-notification-jobs`.

Rotating the service-role key now rotates every copy of it, which is the
property the vault migration was for and did not have until this ran.

## Post-repair verification (closed 2026-08-30)

Every repaired job has now been observed returning 2xx **on its natural
schedule**, in query C (`function_edge_logs`), not by hand-firing it. That
distinction is the point: a manual `curl` proves the handler works, it does not
prove the scheduled row reaches it with credentials it accepts.

| jobid | job                          | schedule              | verified (UTC)   | status | notes                                               |
| ----- | ---------------------------- | --------------------- | ---------------- | ------ | --------------------------------------------------- |
| 7     | `esign-expiry-sweep`         | `0 */6 * * *`         | 2026-08-25 12:00 | 200    | was 401 (observed)                                  |
| 9     | `auto-content-process-due`   | `0 4,8,12,16 * * 1-5` | 2026-08-25 12:00 | 200    | was 401 via module-wide `requireAdmin`, not the key |
| 6     | `overdue-tasks-daily-digest` | `0 4 * * 1-5`         | 2026-08-26 04:00 | 200    | was a malformed URL — never left the DB             |
| 16    | `calendar-daily-digest`      | `0 4 * * 1-5`         | 2026-08-26 04:00 | 200    | was 401 (observed)                                  |
| 17    | `client-birthday-digest`     | `0 5 * * 1-5`         | 2026-08-26 05:00 | 200    | was 404 — the handler did not exist and was written |
| 10    | `client-profile-cleanup`     | `0 22 * * 0`          | 2026-08-30 22:00 | 200    | weekly; the last to come round. See below.          |

### Job 10, the one that took five days to confirm

It runs weekly (Sundays 22:00 UTC), so there was no way to see it on its own
schedule sooner. Its 2026-08-30 run:

```json
{
  "success": true,
  "dryRun": false,
  "totalProfilesScanned": 201,
  "orphanedProfilesClosed": 0,
  "deletedStatusBackfilled": 0,
  "suspendedStatusBackfilled": 0,
  "affectedRecords": [],
  "durationMs": 4209
}
```

`orphanedProfilesClosed: 0` is the **expected** result, not a sign the job did
nothing useful. This job runs live (`dryRun: false`) and the earlier manual
backfill already closed what needed closing; a clean weekly sweep finding
nothing is what steady state looks like. What the run establishes is that the
schedule reaches the handler and the handler is authorised — `totalProfilesScanned: 201`
is the proof it actually did the scan rather than short-circuiting.

**Its pre-repair 401 remains inferred, and now permanently so.** The run that
would have shown it predates the 24-hour log retention window, and the guard the
inference rested on no longer exists to be tested. What is observed is that it
returns 200 now; what is not observed, and never will be, is that it returned
401 before. The table above keeps that honest rather than quietly promoting an
inference to a measurement once the outcome agreed with it.

### What is still true

Both planes must be checked, every time. `cron.job_run_details` reported
`status: succeeded` for job 10 on **every** weekly run going back to 2026-08-02,
including the runs the audit believed were 401ing. That plane records whether
`net.http_post` was queued, not what came back. Query C is the only one that
answers the question.

## Jobs added since the 2026-08-25 audit

The tables above are a point-in-time audit. Jobs created afterwards are listed
here so the next audit starts from a complete set.

| job                                     | schedule (UTC) | target path                                          | setup SQL                                          |
| --------------------------------------- | -------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `client-document-summaries-weekly-scan` | `0 4 * * 6`    | `/client-document-summaries/maintenance/weekly-scan` | `supabase/cron/client-document-summaries-jobs.sql` |

Saturday 06:00 SAST. It writes the AI summaries that the client Documents tab
renders as its activity timeline, for every document batch uploaded in the last
seven days that has none yet. Authenticated with the Vault-backed
`x-nw-cron-auth` token, so it is on the mechanism recommendation 4 above
settled on rather than the service-role key.

Four properties matter when reading its logs:

- The endpoint defaults to `dryRun: true`. A run that reports
  `"generated": 0` with a list of `"dry-run"` results means the job body lost
  its `"dryRun": false` — not that there was nothing to do.
- It never overwrites a summary that worked, so `alreadySummarised` counting up
  week over week is the healthy steady state, not a stall.
- `resumedFromCursor: true` means the previous run hit its `maxGroups` cap and
  this one is draining the backlog: the window started at the carried cursor
  rather than seven days back. Persistently true, with `skipped` staying high,
  means the cap is too low for the upload volume — raise `maxGroups` rather than
  assuming the job is stuck. `nextCursor` is what the following run will use;
  it is `null` on a dry run, which writes no state.
- `retried` counts batches that had failed on an earlier run and were attempted
  again. A batch that is retried every week and keeps failing is a real problem
  with that batch (a corrupt file, an oversized PDF), not a flapping job — its
  stored record carries the error.

## Do this after any change to a scheduled job

Run query A **and** query C. **Query A alone cannot establish that a job works** —
that is the trap this whole runbook is about. `net.http_post` is asynchronous, so
query A stays green for a 401, a 404, or a 5xx. Only query C shows what the
function actually answered. A change is verified when query C shows a 2xx for the
job's target path, at a timestamp matching the schedule.
