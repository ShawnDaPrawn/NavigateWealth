-- ============================================================================
-- APPLIED IN PRODUCTION 2026-08-25 as version 20260825085409.
--
-- Provision a dedicated cron auth token in Vault, plus a boolean oracle the
-- Edge Function can call to verify a candidate without the secret ever leaving
-- the database.
--
-- WHY THIS EXISTS. Ten scheduled jobs authenticated by putting the service-role
-- key in cron.job.command as a literal Bearer token, and the Edge Function
-- guard compared it to Deno.env SUPABASE_SERVICE_ROLE_KEY. Measured 2026-08-25:
-- every cron row carries a token byte-identical to the Vault copy of the
-- service-role key, and the function answers 401 anyway -- so the value the
-- function sees differs from the value the rows send. Most likely a rotation the
-- rows never picked up. The mismatch is invisible from SQL (Edge Function
-- secrets are not readable from the Management API) and would recur on the next
-- rotation, so the mechanism is replaced rather than the value corrected.
--
-- A dedicated token fixes three things at once: it is rotatable without
-- touching any job, it takes the service-role key out of a table that any role
-- with cron.job read access can select, and verification no longer depends on
-- an env var this side cannot read.
--
-- WHY AN ORACLE RATHER THAN A GETTER. verify_cron_auth_token returns only a
-- boolean. A `get_cron_auth_token()` would have to hand the secret to the
-- caller, putting it in PostgREST responses and logs. Brute-forcing a 32-byte
-- random token through a boolean is not a practical attack.
--
-- NOTE: the grants here were incomplete and are corrected by 20260825085435.
-- Read that file too -- the pair is the lesson, not this file alone.
-- ============================================================================

DO $$
DECLARE
  v_token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'navigatewealth_cron_auth_token') THEN
    v_token := encode(extensions.gen_random_bytes(32), 'base64');
    PERFORM vault.create_secret(
      v_token,
      'navigatewealth_cron_auth_token',
      'Shared secret used by pg_cron jobs to authenticate to the make-server-91ed8379 Edge Function. Rotate with vault.update_secret; jobs read it at call time so no job needs editing.'
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.verify_cron_auth_token(candidate text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets s
    WHERE s.name = 'navigatewealth_cron_auth_token'
      AND candidate IS NOT NULL
      AND length(candidate) > 0
      -- Compare digests, not the strings: bytea equality on two fixed-length
      -- hashes leaks nothing useful about the secret's prefix.
      AND extensions.digest(s.decrypted_secret, 'sha256') = extensions.digest(candidate, 'sha256')
  );
$$;

-- Postgres grants EXECUTE to PUBLIC on every new function, and anon and
-- authenticated inherit it. Revoking only from the named roles is a no-op that
-- looks like a fix -- see 20260825004035 for the incident.
REVOKE ALL ON FUNCTION public.verify_cron_auth_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_cron_auth_token(text) TO service_role;
