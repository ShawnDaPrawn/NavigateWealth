-- Navigate Wealth publications cron setup
--
-- Run this in the Supabase SQL Editor after replacing:
--   __SUPABASE_ANON_KEY__
--   __PUBLICATIONS_CRON_AUTH_TOKEN__
--
-- Required Supabase extensions:
--   - pg_cron
--   - pg_net
--   - vault
--
-- Notes:
--   - Per Supabase Cron docs, reusing the same job name overwrites the old job.
--   - This script stores a dedicated publications cron auth token in Vault so the cron job does not
--     expose the shared app-level credential inside the job definition.
--   - Authorization keeps a valid Supabase JWT for Edge gateway access, while
--     x-publications-cron-auth carries the shared publications cron token.

select vault.create_secret(
  '__PUBLICATIONS_CRON_AUTH_TOKEN__',
  'navigatewealth_publications_cron_auth_token'
);

select
  cron.schedule(
    'publications-process-scheduled',
    '* * * * *',
    $$
    select
      net.http_post(
        url:='https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/publications/cron/process-scheduled',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer __SUPABASE_ANON_KEY__',
          'x-publications-cron-auth', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'navigatewealth_publications_cron_auth_token'
          )
        ),
        body:='{}'::jsonb,
        timeout_milliseconds:=20000
      ) as request_id;
    $$
  );

select
  cron.schedule(
    'publications-process-notification-jobs',
    '30 seconds',
    $$
    select
      net.http_post(
        url:='https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/publications/cron/process-notification-jobs',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer __SUPABASE_ANON_KEY__',
          'x-publications-cron-auth', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'navigatewealth_publications_cron_auth_token'
          )
        ),
        body:='{"maxJobs": 5, "maxBatchesPerJob": 4}'::jsonb,
        timeout_milliseconds:=20000
      ) as request_id;
    $$
  );
