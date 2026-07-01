-- Navigate Wealth appointments cron setup
--
-- Run this in the Supabase SQL Editor after replacing:
--   __SUPABASE_ANON_KEY__
--   __APPOINTMENTS_CRON_AUTH_TOKEN__   (generate one, e.g. `openssl rand -hex 32`)
--
-- Required Supabase extensions:
--   - pg_cron
--   - pg_net
--   - vault
--
-- What it does:
--   Every minute, POSTs to the appointments email processor, which drains due
--   rows from appointment_emails (booking confirmations, day-before /
--   morning-of / starting-soon reminders, reschedule + cancellation notices).
--   The every-minute cadence bounds the "5 minutes before" email's jitter to
--   ~60s, so it lands 4–5 minutes ahead of the meeting.
--
-- Notes (same pattern as publications-jobs.sql):
--   - Reusing the same job name overwrites the old job.
--   - The dedicated cron token lives in Vault so the job definition doesn't
--     embed a shared app credential; the edge function compares it against the
--     copy in the KV store (seeded below in the same transaction).
--   - Authorization keeps a valid Supabase JWT for Edge gateway access, while
--     x-appointments-cron-auth carries the shared appointments cron token.

select vault.create_secret(
  '__APPOINTMENTS_CRON_AUTH_TOKEN__',
  'navigatewealth_appointments_cron_auth_token'
);

-- Seed the matching KV copy the edge function validates against
-- (system:appointments:cron_auth_token — see appointments-routes.ts).
insert into public.kv_store_91ed8379 (key, value)
values (
  'system:appointments:cron_auth_token',
  to_jsonb('__APPOINTMENTS_CRON_AUTH_TOKEN__'::text)
)
on conflict (key) do update set value = excluded.value;

select
  cron.schedule(
    'appointments-process-emails',
    '* * * * *',
    $$
    select
      net.http_post(
        url:='https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/appointments/cron/process-emails',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer __SUPABASE_ANON_KEY__',
          'x-appointments-cron-auth', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'navigatewealth_appointments_cron_auth_token'
          )
        ),
        body:='{}'::jsonb,
        timeout_milliseconds:=20000
      ) as request_id;
    $$
  );
