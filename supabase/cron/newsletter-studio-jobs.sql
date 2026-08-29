-- Navigate Wealth newsletter-studio cron setup
--
-- Run this in the Supabase SQL Editor after replacing:
--   __SUPABASE_ANON_KEY__
--
-- Required Supabase extensions:
--   - pg_cron
--   - pg_net
--   - vault
--
-- Notes:
--   - Per Supabase Cron docs, reusing the same job name overwrites the old job.
--   - Unlike the publications pair, no new secret is created here: the studio's
--     cron endpoint uses the shared generic cron token provisioned by migration
--     20260825085409_cron_auth_vault_token.sql (Vault secret
--     navigatewealth_cron_auth_token, verified server-side through the
--     public.verify_cron_auth_token SECURITY DEFINER oracle).
--   - Authorization keeps a valid Supabase JWT for Edge gateway access, while
--     x-nw-cron-auth carries the shared cron token, pulled from Vault at call
--     time so rotation needs no job edits.
--   - The cadence and budgets mirror publications-process-notification-jobs:
--     every 30 seconds, up to 3 campaigns and 4 delivery batches of 20 per run.

select
  cron.schedule(
    'newsletter-studio-process-campaigns',
    '30 seconds',
    $$
    select net.http_post(
      url:='https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/newsletter-studio/cron/process',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer __SUPABASE_ANON_KEY__',
        'x-nw-cron-auth', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'navigatewealth_cron_auth_token'
        )
      ),
      body:='{"maxCampaigns": 3, "maxBatchesPerCampaign": 4}'::jsonb,
      timeout_milliseconds:=20000
    ) as request_id;
    $$
  );
