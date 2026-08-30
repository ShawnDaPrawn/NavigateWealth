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

## Smoke Test

- Follow `supabase/cron/publications-smoke-test.md` after deploy and cron setup

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
