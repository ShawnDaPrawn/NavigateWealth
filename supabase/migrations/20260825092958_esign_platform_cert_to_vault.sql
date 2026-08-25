-- ============================================================================
-- APPLIED IN PRODUCTION 2026-08-25 as version 20260825092958.
--
-- Move the e-sign platform signing certificate out of application-readable
-- storage (SECURITY-AUDIT S4).
--
-- WHAT IS THERE NOW. kv_store_91ed8379 holds
-- 'esign_config:platform_signing_cert' -- a JSON document containing the
-- PKCS#12 archive AND its passphrase, in plaintext, in an ordinary table.
-- Subject "Navigate Wealth E-Signature Platform", created 2026-02-25, valid to
-- 2031. Live material: every completed envelope since February was signed with
-- it. The generic KV API currently denies the `esign_config:` namespace, but
-- that is a denylist entry -- one edit away from re-exposure -- not encryption.
--
-- WHY VAULT AND NOT AN EDGE FUNCTION SECRET. The env-secret path
-- (NW_ESIGN_PLATFORM_P12_BASE64 / _PASSPHRASE) is still the better option and
-- remains the first branch in the code, because material in an env secret is
-- not in the database at all. It requires an operator in the dashboard: there
-- is no Management API tool for Edge Function secrets reachable from an agent
-- session. Vault is the best available improvement that needs no operator --
-- encrypted at rest with a key held outside the database, and unreachable
-- through the application's own KV endpoints.
--
-- BE CLEAR ABOUT WHAT THIS IS NOT. Signing needs the private key in the
-- function's memory, so unlike the cron token this cannot be a boolean oracle --
-- the getter really does hand the key to its caller. The gain is that the
-- key stops sitting unencrypted in a general-purpose table, and that reading it
-- now requires service_role EXECUTE on one narrowly-granted function instead of
-- a row read. That is a real reduction in exposure, not equivalence with an env
-- secret.
--
-- The copy below happens entirely inside SQL, so the material is never rendered
-- into a transcript, a log, or a tool result.
--
-- THE KV ROW IS DELIBERATELY LEFT IN PLACE. Deleting it before the reading code
-- is deployed and confirmed would break every envelope completion -- an outage
-- on a compliance path, caused by a security fix. Removal is a separate step
-- once the Vault path is observed working.
--
-- Verified after applying: the Vault copy's sha256 equals the KV row's, the
-- getter returns subject "Navigate Wealth E-Signature Platform" with a
-- 3,680-char p12Base64 and a passphrase, and proacl is
-- postgres=X/postgres | service_role=X/postgres.
-- ============================================================================

DO $$
DECLARE
  v_cert text;
BEGIN
  SELECT value::text INTO v_cert
  FROM public.kv_store_91ed8379
  WHERE key = 'esign_config:platform_signing_cert';

  IF v_cert IS NULL THEN
    RAISE NOTICE 'No platform signing cert in KV -- nothing to migrate.';
  ELSIF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'navigatewealth_esign_platform_cert') THEN
    RAISE NOTICE 'Vault already holds the platform signing cert -- leaving it alone.';
  ELSE
    PERFORM vault.create_secret(
      v_cert,
      'navigatewealth_esign_platform_cert',
      'E-sign platform signing certificate: the same JSON document previously held at kv_store_91ed8379 key esign_config:platform_signing_cert (p12Base64, passphrase, subject, createdAt, expiresAt). Read via public.get_esign_platform_cert().'
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_esign_platform_cert()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.decrypted_secret::jsonb
  FROM vault.decrypted_secrets s
  WHERE s.name = 'navigatewealth_esign_platform_cert'
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

-- BOTH revokes, and then assert the ACL. Revoking PUBLIC alone leaves the
-- explicit anon/authenticated grants this project's default privileges create;
-- revoking the named roles alone leaves PUBLIC. See 20260825004035 and
-- 20260825085435 -- this codebase has now made each half of that mistake once.
REVOKE ALL ON FUNCTION public.get_esign_platform_cert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_esign_platform_cert() FROM anon;
REVOKE ALL ON FUNCTION public.get_esign_platform_cert() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_esign_platform_cert() TO service_role;
