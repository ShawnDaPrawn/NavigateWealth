# Publications Cron Setup

Use `supabase/cron/publications-jobs.sql` to create the production cron jobs for article publishing and newsletter delivery.

## What it creates

- `publications-process-scheduled`
  - Runs every minute.
  - Publishes due scheduled articles.
  - Also drains queued article notification work as part of the scheduled publish pass.
- `publications-process-notification-jobs`
  - Runs every 30 seconds.
  - Advances queued article email delivery independently of the admin browser.
  - Processes up to 5 jobs and up to 4 send batches per job on each run.

## Before you run it

- In Supabase Dashboard, make sure `pg_cron`, `pg_net`, and `vault` are enabled.
- Replace `__SUPABASE_ANON_KEY__` in the SQL file with the project anon key used for Edge Function gateway access.
- Replace `__PUBLICATIONS_CRON_AUTH_TOKEN__` in the SQL file with the shared token stored in KV under `system:publications:cron_auth_token`.

## Where to run it

- Supabase Dashboard
- `SQL Editor`
- Paste the contents of `supabase/cron/publications-jobs.sql`
- Run once

## Verify

- In Supabase Dashboard, open `Integrations -> Cron`
- Confirm both jobs exist and are active
- Confirm recent runs in `cron.job_run_details`
- Or run `supabase/cron/verify-publications-jobs.sql` in SQL Editor

## Publications Smoke Test

Run this after deploying the edge function and creating the cron jobs.

Use this after deploying the edge function and creating the cron jobs.

### 1. Verify cron jobs exist

- Open Supabase SQL Editor.
- Run `supabase/cron/verify-publications-jobs.sql`.
- Confirm both job names are present:
  - `publications-process-scheduled`
  - `publications-process-notification-jobs`
- Confirm recent `cron.job_run_details` rows show `status = succeeded`.

### 2. Publish test article

- In admin, create or open a non-critical article.
- Publish it with `Notify newsletter subscribers` enabled.
- Confirm the publish modal shows a queued delivery job.
- Confirm the modal or engagement panel shows a recipient count larger than 10 if you have more than 10 subscribers.

### 3. Watch delivery progress

- Wait 1 to 2 minutes.
- Open the article email engagement panel.
- Confirm `sent` keeps increasing without keeping the admin tab focused.
- Confirm `pending` trends down toward zero.

### 4. Validate full recipient coverage

- Compare:
  - newsletter subscriber count
  - article notification job recipient count
  - final `sent + failed`
- These should reconcile. If they do not, inspect the failed recipient rows and the job's `lastError`.

### 5. Retry smoke test

- If any recipients are `failed`, click retry.
- Confirm a retry job is queued for the undelivered publish recipients.
- Wait another 1 to 2 minutes.
- Confirm:
  - `pending` decreases again
  - `sent` increases or `failed` remains with a concrete provider error
  - retry does not stop after a single recipient unless only one undelivered recipient remained

### 6. Failure handling check

- If failures remain, confirm the recipient detail rows show a specific delivery error message.
- Confirm the article remains published even if some deliveries fail.
- Confirm retry is still available for remaining undelivered publish recipients.

### Good outcome

- Article publishes immediately.
- Delivery continues even if the admin page is closed or idle.
- Large sends progress beyond the first 10 recipients automatically.
- Retry processes the real remaining undelivered set, not a stale subset.

## Newsletter Studio Cron Setup

Use `supabase/cron/newsletter-studio-jobs.sql` to create the campaign delivery job for the
Newsletter Studio admin module.

- `newsletter-studio-process-campaigns`
  - Runs every 30 seconds.
  - Promotes due scheduled campaigns and advances queued campaign delivery
    independently of the admin browser (which acts only as a best-effort accelerator).
  - Processes up to 3 campaigns and up to 4 send batches of 20 per run.
- Before you run it, replace `__SUPABASE_ANON_KEY__` with the project anon key. No new
  secret is needed: the job authenticates with the shared `x-nw-cron-auth` token already
  provisioned in Vault by migration `20260825085409_cron_auth_vault_token.sql` and verified
  server-side through `public.verify_cron_auth_token`.
- Verify the same way as the publications jobs: confirm the job exists under
  `Integrations -> Cron` and shows recent runs in `cron.job_run_details`, then confirm the
  Edge Function logs show `POST /newsletter-studio/cron/process` returning 200 (remember
  `cron.job_run_details` stays green even when the HTTP call fails).

## Client Document Summaries Cron Setup

Use `supabase/cron/client-document-summaries-jobs.sql` to create the weekly job that keeps
the client Documents tab's AI activity timeline up to date.

- `client-document-summaries-weekly-scan`
  - Runs every Saturday at 04:00 UTC (06:00 SAST).
  - Summarises every document batch with activity in the last 7 days that has no usable
    summary yet, oldest first, up to 40 batches per run.
  - Work beyond that cap is genuinely carried, not dropped: the scan keeps a cursor
    (`client-doc-summary-scan:state`) at the oldest deferred batch, and the next run starts
    its window there rather than seven days back. A report with `resumedFromCursor: true`
    means it is draining a backlog. A dry run never moves the cursor.
  - A batch is a candidate when ANY of its documents landed in the window, and its summary
    then covers the whole pack — a pack that gains a file this week is re-summarised in
    full rather than as the recent fragment.
  - It never overwrites a summary that worked, including one a super admin has edited. The
    endpoint's `force` flag exists for a manual re-run and must not be set in the job. A
    `failed` record is the exception: it is retried on the next run, and shows in the
    report's `retried` count.
- Before you run it, replace `__SUPABASE_ANON_KEY__` with the project anon key. No new
  secret is needed: the job authenticates with the shared `x-nw-cron-auth` token already
  provisioned in Vault by migration `20260825085409_cron_auth_vault_token.sql` and verified
  server-side through `public.verify_cron_auth_token`.
- The endpoint defaults to `dryRun: true`, so a hand-run `curl` that forgets the flag
  reports what it WOULD do rather than spending an OpenAI call per batch. The job body sets
  `"dryRun": false` explicitly. To rehearse before scheduling:

  ```bash
  curl -sS -X POST \
    "$FUNCTION_URL/client-document-summaries/maintenance/weekly-scan" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -d '{"lookbackDays": 7}'
  ```

### Choosing the model

The summariser no longer sits on `gpt-4o` by default. It asks the account which models it can
serve and takes the highest-ranked entry from `SUMMARY_MODEL_PREFERENCES` in
`client-document-summaries-ai.ts` — cost-tier models first, since this is short,
schema-constrained output over a handful of documents.

That ranking is a preference, not a claim any of those models exist. Entries the account does
not serve are skipped, so a name that is wrong, retired, or invented cannot 400 a request. If
none match, or the probe fails, it uses `OPENAI_PRIMARY_MODEL` — today's behaviour. The worst
case of a stale list is a no-op.

To see what this account actually serves, read the Edge Function logs for
`OpenAI models available to this account` — the first summary after each cold start logs the
real text-model list, so no API key is needed in hand. Reorder the preference list against it.
Equivalently, from a shell:

```bash
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq -r '.data[].id' | sort
```

To pin one model and skip the ranking entirely, set `OPENAI_SUMMARY_MODEL` (Supabase → Edge
Functions → Secrets). An explicit setting wins outright and runs no probe. Clear it to return
to the ranking.

Set the per-feature var, never the global `OPENAI_MODEL`. That one is read by eleven services,
most of which call OpenAI through Chat Completions with no model fallback — an id the account
cannot serve is a 400 and the feature is dead. That is the `gpt-5.4` incident recorded in
`ai-model-config.ts`. The summariser goes through `callResponses`, which retries on `gpt-4o`,
so it is the one caller that degrades instead of breaking.

After any change, confirm what took: open any client's Documents tab, click **Summarise** on a
pending batch, and read the model name on the new entry. That field records the model that
ANSWERED, so a rejected id shows as `gpt-4o` — the silent fallback is visible.

- Verify the same way as the other jobs: confirm the job exists under `Integrations -> Cron`
  and shows recent runs in `cron.job_run_details`, then confirm the Edge Function logs show
  `POST /client-document-summaries/maintenance/weekly-scan` returning 200. `cron.job_run_details`
  stays green even when the HTTP call fails — see `docs/runbooks/scheduled-jobs.md`.
