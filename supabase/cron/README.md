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
  - Processes up to 5 jobs and up to 3 send batches per job on each run.

## Before you run it

- In Supabase Dashboard, make sure `pg_cron`, `pg_net`, and `vault` are enabled.
- Replace `__SUPABASE_SERVICE_ROLE_KEY__` in the SQL file with your actual project service role key.

## Where to run it

- Supabase Dashboard
- `SQL Editor`
- Paste the contents of `supabase/cron/publications-jobs.sql`
- Run once

## Verify

- In Supabase Dashboard, open `Integrations -> Cron`
- Confirm both jobs exist and are active
- Confirm recent runs in `cron.job_run_details`
