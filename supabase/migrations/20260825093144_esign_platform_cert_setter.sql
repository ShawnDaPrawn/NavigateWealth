-- ============================================================================
-- APPLIED IN PRODUCTION 2026-08-25 as version 20260825093144.
--
-- Companion to get_esign_platform_cert: lets the Edge Function persist a
-- REGENERATED certificate to Vault rather than back to the plaintext KV table.
--
-- The certificate has a 5-year validity, so this fires roughly once every five
-- years -- but that is exactly the path that would silently reintroduce the
-- problem 20260825092958 just fixed, by writing fresh private key material into
-- kv_store_91ed8379 the moment the current cert expires (2031-02-25). A
-- read-only migration would have left a five-year fuse.
--
-- Upsert semantics: create the secret if absent, otherwise update in place so
-- the name stays stable and get_esign_platform_cert keeps resolving.
--
-- Verified after applying: round-tripping the live cert through
-- set_esign_platform_cert(get_esign_platform_cert()) leaves its sha256
-- unchanged and does not create a second secret; all four malformed inputs
-- (null, {}, p12 only, empty p12) raise; proacl is
-- postgres=X/postgres | service_role=X/postgres.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_esign_platform_cert(cert jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF cert IS NULL
     OR coalesce(cert->>'p12Base64', '') = ''
     OR coalesce(cert->>'passphrase', '') = '' THEN
    RAISE EXCEPTION 'set_esign_platform_cert: cert must carry p12Base64 and passphrase';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = 'navigatewealth_esign_platform_cert';

  IF v_id IS NULL THEN
    PERFORM vault.create_secret(
      cert::text,
      'navigatewealth_esign_platform_cert',
      'E-sign platform signing certificate (p12Base64, passphrase, subject, createdAt, expiresAt). Written by public.set_esign_platform_cert on regeneration.'
    );
  ELSE
    PERFORM vault.update_secret(v_id, cert::text);
  END IF;
END
$$;

-- Both revokes, then assert. See 20260825004035 and 20260825085435.
REVOKE ALL ON FUNCTION public.set_esign_platform_cert(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_esign_platform_cert(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.set_esign_platform_cert(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_esign_platform_cert(jsonb) TO service_role;
