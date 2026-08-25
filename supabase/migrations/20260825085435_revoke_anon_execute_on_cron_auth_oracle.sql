-- ============================================================================
-- APPLIED IN PRODUCTION 2026-08-25 as version 20260825085435.
--
-- The mirror image of the mistake in 20260825004035, and worth recording as its
-- own migration rather than folded into the previous one.
--
-- 20260825004011 revoked EXECUTE from anon and authenticated and left the PUBLIC
-- grant in place -- a no-op. 20260825004035 fixed that by revoking from PUBLIC.
--
-- The cron-auth oracle then made the opposite error: it revoked from PUBLIC and
-- stopped there, and the ACL came back
--   postgres=X/postgres | anon=X/postgres | authenticated=X/postgres | service_role=X/postgres
-- because this project has ALTER DEFAULT PRIVILEGES granting EXECUTE on new
-- functions in `public` to anon and authenticated. Those are explicit grants,
-- not inherited from PUBLIC, so revoking PUBLIC does not touch them.
--
-- The rule both incidents point at: on a SECURITY DEFINER function in `public`,
-- revoke from PUBLIC *and* from anon/authenticated, then read pg_proc.proacl
-- back and assert what it says. Neither revoke implies the other, and which one
-- actually holds the grant depends on the project's default privileges.
--
-- Verified after applying: proacl = postgres=X/postgres | service_role=X/postgres
-- and the oracle still returns true for the real secret.
-- ============================================================================

REVOKE ALL ON FUNCTION public.verify_cron_auth_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_cron_auth_token(text) FROM anon;
REVOKE ALL ON FUNCTION public.verify_cron_auth_token(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_auth_token(text) TO service_role;
