-- Navigate Wealth publications cron setup
--
-- Run this in the Supabase SQL Editor after replacing:
--   __SUPABASE_SERVICE_ROLE_KEY__
--
-- Required Supabase extensions:
--   - pg_cron
--   - pg_net
--   - vault
--
-- Notes:
--   - Per Supabase Cron docs, reusing the same job name overwrites the old job.
--   - This script stores the service role key in Vault so the cron job does not
--     expose credentials inside the job definition.

select vault.create_secret(
  'https://vpjmdsltwrnpefzcgdmz.supabase.co',
  'navigatewealth_project_url'
);

select vault.create_secret(
  '__SUPABASE_SERVICE_ROLE_KEY__',
  'navigatewealth_service_role_key'
);

select
  cron.schedule(
    'publications-process-scheduled',
    '* * * * *',
    $$
    select
      net.http_post(
        url:=(
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'navigatewealth_project_url'
        ) || '/functions/v1/make-server-91ed8379/publications/cron/process-scheduled',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'navigatewealth_service_role_key'
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
        url:=(
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'navigatewealth_project_url'
        ) || '/functions/v1/make-server-91ed8379/publications/cron/process-notification-jobs',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'navigatewealth_service_role_key'
          )
        ),
        body:='{"maxJobs": 5, "maxBatchesPerJob": 3}'::jsonb,
        timeout_milliseconds:=20000
      ) as request_id;
    $$
  );
