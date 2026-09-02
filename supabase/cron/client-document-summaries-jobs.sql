-- Navigate Wealth client document summary cron setup
--
-- Run this in the Supabase SQL Editor after replacing:
--   __SUPABASE_ANON_KEY__
--
-- Required Supabase extensions:
--   - pg_cron
--   - pg_net
--   - vault
--
-- WHAT IT DOES
--   Once a week it asks the Edge Function to summarise every document batch
--   uploaded in the last 7 days that has no summary yet. Those summaries are
--   what the client's Documents tab renders as its activity timeline.
--
-- WHY SATURDAY 06:00 SAST
--   SAST is UTC+2, so the cron expression is 04:00 UTC. Saturday keeps a run
--   that costs an OpenAI call per batch off the working week, and leaves the
--   whole weekend for a failed run to be noticed before Monday.
--
-- WHY dryRun IS FALSE HERE
--   The endpoint defaults to a dry run on purpose (§14.1), so a hand-run curl
--   that forgets the flag reports rather than spends. The scheduled job is the
--   one caller that means it, so it says so explicitly.
--
-- SAFETY PROPERTIES WORTH KNOWING BEFORE CHANGING THE BODY
--   - The scan NEVER overwrites an existing summary, including one a super
--     admin has edited. `force` exists but must not be set here.
--   - maxGroups caps one run's spend. Batches beyond it are reported as
--     skipped and picked up by the next run.
--
-- Notes:
--   - Reusing the same job name overwrites the old job (Supabase Cron docs).
--   - No new secret is created: the job authenticates with the shared cron
--     token provisioned by migration 20260825085409_cron_auth_vault_token.sql
--     (Vault secret navigatewealth_cron_auth_token, verified server-side by the
--     public.verify_cron_auth_token SECURITY DEFINER oracle).
--   - Authorization keeps a valid Supabase JWT for Edge gateway access, while
--     x-nw-cron-auth carries the cron token, pulled from Vault at call time so
--     rotation needs no job edits.
--   - timeout_milliseconds is generous because one run may make several model
--     calls. pg_net only enqueues, so this bounds the request, not the job.

select
  cron.schedule(
    'client-document-summaries-weekly-scan',
    '0 4 * * 6',
    $$
    select net.http_post(
      url:='https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/client-document-summaries/maintenance/weekly-scan',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer __SUPABASE_ANON_KEY__',
        'x-nw-cron-auth', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'navigatewealth_cron_auth_token'
        )
      ),
      body:='{"lookbackDays": 7, "dryRun": false, "maxGroups": 40}'::jsonb,
      timeout_milliseconds:=120000
    ) as request_id;
    $$
  );
