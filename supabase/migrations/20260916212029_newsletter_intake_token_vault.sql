-- ============================================================================
-- Newsletter intake token in Vault + boolean oracle
-- ============================================================================
--
-- WHY THIS EXISTS
-- The HTTPS hand-over path (`POST /newsletter-intake/submit`) needs a shared
-- secret the monthly routine sends as `x-nw-newsletter-intake-token`. The
-- first cut compared that header against an Edge Function env var
-- (`NW_NEWSLETTER_INTAKE_TOKEN`). That is the mechanism whose silent drift
-- took every cron job down on 2026-08-25 (see cron-auth.ts and migration
-- 20260825085409): Edge Function secrets cannot be read or set through the
-- Management API or MCP, so a mismatch is invisible from SQL and cannot be
-- corrected from here either.
--
-- So, as with the cron token, the secret lives in Vault and the Edge Function
-- verifies a candidate through a SECURITY DEFINER boolean oracle. The secret
-- never crosses into the function; rotation is one `vault.update_secret` with
-- no redeploy. The env var remains as a local-development override only.
--
-- WHY AN ORACLE RATHER THAN A GETTER: a getter would hand the secret to the
-- caller, putting it in PostgREST responses and logs. Brute-forcing 32 random
-- bytes through a boolean is not a practical attack.
--
-- GRANTS: revoke from PUBLIC *and* anon/authenticated. This project's default
-- privileges grant EXECUTE on new public functions to anon and authenticated
-- explicitly, so revoking PUBLIC alone leaves them (20260825085435 lesson).
-- ============================================================================

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'navigatewealth_newsletter_intake_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'navigatewealth_newsletter_intake_token',
      'Shared secret the monthly newsletter routine sends as x-nw-newsletter-intake-token to POST /newsletter-intake/submit on make-server-91ed8379. Verified by public.verify_newsletter_intake_token; rotate with vault.update_secret (no redeploy).'
    );
  end if;
end
$$;

create or replace function public.verify_newsletter_intake_token(candidate text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets s
    where s.name = 'navigatewealth_newsletter_intake_token'
      and candidate is not null
      and length(candidate) > 0
      -- Compare digests, not the strings: bytea equality on two fixed-length
      -- hashes leaks nothing useful about the secret's prefix.
      and extensions.digest(s.decrypted_secret, 'sha256') = extensions.digest(candidate, 'sha256')
  );
$$;

comment on function public.verify_newsletter_intake_token(text) is
  'Boolean oracle for the newsletter intake token held in Vault (navigatewealth_newsletter_intake_token). service_role only.';

revoke all on function public.verify_newsletter_intake_token(text) from public;
revoke all on function public.verify_newsletter_intake_token(text) from anon;
revoke all on function public.verify_newsletter_intake_token(text) from authenticated;
grant execute on function public.verify_newsletter_intake_token(text) to service_role;
