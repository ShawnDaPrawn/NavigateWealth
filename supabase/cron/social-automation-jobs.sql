-- Navigate Wealth social automation cron setup
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
--   Two small hourly jobs that support the routine-driven weekly pipeline
--   (docs/runbooks/social-automation.md):
--
--   social-automation-render-images
--     Renders an image (DALL-E 3, into the public social-assets bucket) for
--     every asset the generation routine wrote with an `image_brief`. The
--     routine runs on Saturday; images are ready long before the scheduling
--     routine runs on Sunday. Idle runs cost one HTTP call and no model call.
--
--   social-automation-sync-buffer
--     Mirrors Buffer's status onto the assets the scheduling routine created
--     there: `sent` becomes `published`, `error` becomes `failed` with the
--     message. This is what makes the Assets tab and calendar truthful without
--     the browser doing the work.
--
-- WHY dryRun IS FALSE HERE
--   Both endpoints default to a dry run on purpose (§14.1), so a hand-run curl
--   that forgets the flag reports rather than spends. The scheduled jobs are the
--   callers that mean it, so they say so explicitly.
--
-- Notes:
--   - Reusing the same job name overwrites the old job (Supabase Cron docs).
--   - No new secret is created: the jobs authenticate with the shared cron
--     token provisioned by migration 20260825085409_cron_auth_vault_token.sql
--     (Vault secret navigatewealth_cron_auth_token, verified server-side by the
--     public.verify_cron_auth_token SECURITY DEFINER oracle).
--   - Authorization keeps a valid Supabase JWT for Edge gateway access, while
--     x-nw-cron-auth carries the cron token, pulled from Vault at call time.
--   - Verify with query A AND query C in docs/runbooks/scheduled-jobs.md:
--     cron.job_run_details stays green even when the function answers 401/404.

select
  cron.schedule(
    'social-automation-render-images',
    '15 * * * *',
    $$
    select net.http_post(
      url:='https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/social-assets/jobs/render-images',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer __SUPABASE_ANON_KEY__',
        'x-nw-cron-auth', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'navigatewealth_cron_auth_token'
        )
      ),
      body:='{"dryRun": false, "maxImages": 12}'::jsonb,
      timeout_milliseconds:=120000
    ) as request_id;
    $$
  );

select
  cron.schedule(
    'social-automation-sync-buffer',
    '40 * * * *',
    $$
    select net.http_post(
      url:='https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/social-assets/jobs/sync-buffer',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer __SUPABASE_ANON_KEY__',
        'x-nw-cron-auth', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'navigatewealth_cron_auth_token'
        )
      ),
      body:='{"dryRun": false, "maxPosts": 50}'::jsonb,
      timeout_milliseconds:=60000
    ) as request_id;
    $$
  );
