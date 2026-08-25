-- ============================================================================
-- APPLIED IN PRODUCTION 2026-08-25 as version 20260825004035.
--
-- Closes the remaining 6 advisor findings
-- (`0028`/`0029_*_security_definer_function_executable`).
--
-- THE MISTAKE THIS FIXES IS WORTH READING. 20260825004011 revoked EXECUTE from
-- `anon` and `authenticated` and changed nothing: Postgres grants EXECUTE to
-- PUBLIC by default on every new function, and both roles inherit it. The ACL
-- still read `=X/postgres` — the empty grantee IS PUBLIC — and the advisors
-- still flagged all three functions. Revoking from named roles while leaving
-- the PUBLIC grant in place is a no-op that looks exactly like a fix.
--
-- Verified after applying: 17 security lints → 2. The two that remain are
-- `rls_enabled_no_policy` on kv_store_91ed8379 (INFO, and correct by design —
-- RLS on with no policies denies everyone except the service role, which is the
-- only thing that touches it) and the leaked-password-protection toggle, which
-- is an operator action in the dashboard.
--
-- Nothing in the repository calls these four functions (verified by grep across
-- src/ on 2026-08-25). They are revoked rather than dropped because a dashboard
-- or ad-hoc query outside this repo may use them; dropping is a separate,
-- explicit decision. service_role keeps EXECUTE.
-- ============================================================================

REVOKE ALL ON FUNCTION public.get_reminders_due_today() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_upcoming_reminders(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_events_today() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_overdue_reminders() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_reminders_due_today() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_upcoming_reminders(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_events_today() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_overdue_reminders() TO service_role;
