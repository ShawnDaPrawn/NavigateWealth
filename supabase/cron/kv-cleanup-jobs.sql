-- Navigate Wealth nightly KV cleanup cron setup
--
-- Run once in the Supabase SQL Editor (or via the Supabase MCP `execute_sql`).
-- Nothing to substitute: no key or token appears in this file.
--
-- Required Supabase extensions:
--   - pg_cron
--   - pg_net
--   - vault
--
-- WHAT IT DOES
--   Every night it asks the Edge Function to run the KV cleanup
--   (POST /kv-cleanup/cron), which deletes transient KV rows: rate-limit
--   entries older than an hour, newsletter confirmations past their 48-hour
--   window, contact, consultation and quote submissions older than 90 days, and
--   audit entries older than 365 days. See kv-cleanup-service.ts.
--
-- WHY THIS EXISTS (2026-10-12)
--   Until now nothing scheduled this cleanup. Its only runner was a poller in
--   the admin browser tab (`useMaintenanceCronProcessor`), so it ran only while
--   an admin had the portal open, and every open admin tab carried that work.
--   The owner chose a nightly server schedule; the browser poller is removed in
--   the same change.
--
-- WHY 23:30 UTC (01:30 SAST)
--   SAST is UTC+2. The middle of the South African night, clear of the working
--   day, and clear of the 02:00/02:20 UTC database-maintenance jobs.
--
-- Notes:
--   - Reusing the same job name overwrites the old job (Supabase Cron docs).
--   - No new secret: the job authenticates with the shared cron token
--     provisioned by migration 20260825085409_cron_auth_vault_token.sql (Vault
--     secret navigatewealth_cron_auth_token, verified server-side by the
--     public.verify_cron_auth_token SECURITY DEFINER oracle via requireCronAuth).
--   - No Authorization header: the function runs with verify_jwt = false, the
--     same as the existing client-profile-cleanup and overdue-tasks-daily-digest
--     jobs, which answer 200 without one.
--   - pg_cron marks a run succeeded as soon as the request is enqueued, so a 401
--     would not show in cron.job_run_details. Check net._http_response (below)
--     after the first run. docs/runbooks/scheduled-jobs.md has the details.

select
  cron.schedule(
    'kv-cleanup-nightly',
    '30 23 * * *',
    $$
    select net.http_post(
      url := 'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/kv-cleanup/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-nw-cron-auth', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'navigatewealth_cron_auth_token'
          order by created_at desc
          limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
    $$
  );

-- Verify the job exists:
--   select jobname, schedule, active from cron.job where jobname = 'kv-cleanup-nightly';
--
-- After a run, confirm the function answered 200 (not 401):
--   select status_code, left(content::text, 200), created
--   from net._http_response order by created desc limit 5;
