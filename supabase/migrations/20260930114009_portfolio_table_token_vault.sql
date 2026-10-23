-- ============================================================================
-- Portfolio table integration token in Vault + boolean oracle
-- ============================================================================
--
-- WHY THIS EXISTS
-- `/integrations/portfolio-table` on make-server-91ed8379 is the endpoint an
-- outside agent (a scheduled bot) reads a provider's policy book from and
-- posts corrections to. It has no user session, so it authenticates with a
-- shared secret sent as `x-nw-portfolio-token`.
--
-- As with the cron, newsletter-intake and social-library tokens, the secret
-- lives in Vault and the Edge Function verifies a candidate through a
-- SECURITY DEFINER boolean oracle: Edge Function secrets cannot be read or
-- set through the Management API or MCP, so a mismatch there is invisible
-- from SQL and uncorrectable from here (the drift that took every cron job
-- down on 2026-08-25). Here the secret never crosses into the function and
-- rotation is one `vault.update_secret` with no redeploy.
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
  if not exists (select 1 from vault.secrets where name = 'navigatewealth_portfolio_table_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'navigatewealth_portfolio_table_token',
      'Shared secret an outside agent sends as x-nw-portfolio-token to /integrations/portfolio-table on make-server-91ed8379. Verified by public.verify_portfolio_table_token; rotate with vault.update_secret (no redeploy).'
    );
  end if;
end
$$;

create or replace function public.verify_portfolio_table_token(candidate text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets s
    where s.name = 'navigatewealth_portfolio_table_token'
      and candidate is not null
      and length(candidate) > 0
      -- Compare digests, not the strings: bytea equality on two fixed-length
      -- hashes leaks nothing useful about the secret's prefix.
      and extensions.digest(s.decrypted_secret, 'sha256') = extensions.digest(candidate, 'sha256')
  );
$$;

comment on function public.verify_portfolio_table_token(text) is
  'Boolean oracle for the portfolio table integration token held in Vault (navigatewealth_portfolio_table_token). service_role only.';

revoke all on function public.verify_portfolio_table_token(text) from public;
revoke all on function public.verify_portfolio_table_token(text) from anon;
revoke all on function public.verify_portfolio_table_token(text) from authenticated;
grant execute on function public.verify_portfolio_table_token(text) to service_role;
