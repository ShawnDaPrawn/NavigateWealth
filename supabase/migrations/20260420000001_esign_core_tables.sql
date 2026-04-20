-- =============================================================================
-- E-Sign Core Tables (Phase 0.1 — Postgres migration)
-- =============================================================================
--
-- Purpose:
--   Replace `kv.getByPrefix('esign:envelope:')` (O(N) full-prefix scan) with
--   indexed Postgres tables. This unblocks every later phase that needs
--   efficient querying:
--     • Org metrics dashboards (Phase 7.1)
--     • Stuck-envelope alerts   (Phase 7.2)
--     • Searchable audit log    (Phase 7.3)
--     • Public verification     (Phase 6.2)
--     • Per-firm RLS            (Phase 6.9)
--
-- Migration strategy (the only safe one for production data):
--   1. Run this migration → tables exist, all empty.
--   2. Deploy code with `ESIGN_DUAL_WRITE=true` → every mutating route
--      writes to BOTH the KV store AND Postgres. Reads stay on KV.
--   3. Backfill historical KV data with `scripts/esign-backfill.mjs`.
--   4. Switch `ESIGN_READ_FROM=postgres` → reads come from Postgres,
--      writes still dual-write (safety net).
--   5. After 7+ days of clean reads, switch to Postgres-only writes and
--      stop dual-writing (`ESIGN_DUAL_WRITE=false`).
--   6. After the next compliance retention window, drop the legacy KV keys.
--
-- All identifiers below are explicit (not generated) so we can re-use the
-- same primary keys when backfilling from KV — no rebinding of foreign
-- keys, no broken signing-token URLs.
-- =============================================================================

-- Run inside a single transaction — either everything lands or nothing does.
BEGIN;

-- ── Schema namespace ────────────────────────────────────────────────────────
-- We use the `public` schema so existing PostgREST tooling sees the tables,
-- but every table is prefixed with `esign_` so it cannot collide with any
-- existing object.

-- ── Envelopes ───────────────────────────────────────────────────────────────
-- One row per envelope. The `firm_id` column is required from day one even
-- though we are single-tenant today — without it, Phase 6.9 (per-firm RLS)
-- becomes a multi-week destructive migration later.

CREATE TABLE IF NOT EXISTS public.esign_envelopes (
  id              text PRIMARY KEY,
  firm_id         uuid NOT NULL,
  -- Owner (sender). May be null for system-created envelopes (rare).
  created_by      uuid,
  title           text NOT NULL,
  message         text,
  status          text NOT NULL CHECK (status IN (
    'draft', 'sent', 'viewed', 'partially_signed',
    'completed', 'declined', 'voided', 'expired', 'recalled'
  )),
  signing_mode    text NOT NULL DEFAULT 'sequential'
                       CHECK (signing_mode IN ('sequential', 'parallel')),
  document_url    text,
  document_hash   text,
  document_pages  integer,
  expires_at      timestamptz,
  sent_at         timestamptz,
  completed_at    timestamptz,
  voided_at       timestamptz,
  -- Free-form metadata bag. Indexed via GIN below for ad-hoc queries.
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.esign_envelopes IS
  'Phase 0.1: Top-level envelope records. Replaces esign:envelope:<id> KV keys.';
COMMENT ON COLUMN public.esign_envelopes.id IS
  'Stable id reused from KV store during dual-write window.';
COMMENT ON COLUMN public.esign_envelopes.firm_id IS
  'Required for Phase 6.9 per-firm RLS. Required even when single-tenant.';

-- Hot read paths:
--   • Dashboard list:  WHERE firm_id = ? AND status = ? ORDER BY updated_at DESC
--   • Recent activity: WHERE firm_id = ? ORDER BY updated_at DESC LIMIT 50
--   • Expiry sweep:    WHERE status IN ('sent','viewed','partially_signed')
--                       AND expires_at < now()
CREATE INDEX IF NOT EXISTS esign_envelopes_firm_status_updated_idx
  ON public.esign_envelopes (firm_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS esign_envelopes_firm_updated_idx
  ON public.esign_envelopes (firm_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS esign_envelopes_active_expiry_idx
  ON public.esign_envelopes (expires_at)
  WHERE status IN ('sent', 'viewed', 'partially_signed');

CREATE INDEX IF NOT EXISTS esign_envelopes_metadata_gin_idx
  ON public.esign_envelopes USING gin (metadata);

-- ── Signers ─────────────────────────────────────────────────────────────────
-- N rows per envelope. `access_token` is unique GLOBALLY (signers can sign
-- via a single bookmarked URL) — but we still scope queries by envelope_id
-- for performance.

CREATE TABLE IF NOT EXISTS public.esign_signers (
  id              text PRIMARY KEY,
  envelope_id     text NOT NULL
                  REFERENCES public.esign_envelopes(id) ON DELETE CASCADE,
  email           citext NOT NULL,  -- citext: email lookups must be case-insensitive
  name            text NOT NULL,
  phone           text,
  role            text,
  -- 'signer' | 'witness' | 'cc' (Phase 2.7/2.8)
  kind            text NOT NULL DEFAULT 'signer'
                       CHECK (kind IN ('signer', 'witness', 'cc')),
  signing_order   integer NOT NULL DEFAULT 1,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'viewed', 'otp_verified',
    'signed', 'declined', 'expired'
  )),
  access_token    text NOT NULL UNIQUE,
  otp_required    boolean NOT NULL DEFAULT false,
  access_code     text,
  client_id       uuid,             -- FK to navigate-wealth client table (added in app)
  is_system_client boolean NOT NULL DEFAULT false,
  signed_at       timestamptz,
  declined_at     timestamptz,
  decline_reason  text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Enable citext extension for case-insensitive email column.
-- Idempotent: CREATE EXTENSION ... IF NOT EXISTS.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE INDEX IF NOT EXISTS esign_signers_envelope_idx
  ON public.esign_signers (envelope_id, signing_order);

CREATE INDEX IF NOT EXISTS esign_signers_email_idx
  ON public.esign_signers (email);

CREATE INDEX IF NOT EXISTS esign_signers_pending_idx
  ON public.esign_signers (envelope_id)
  WHERE status IN ('pending', 'sent', 'viewed', 'otp_verified');

-- ── Fields ──────────────────────────────────────────────────────────────────
-- Form fields placed on the document. Stored as percentage coordinates so
-- we are resolution-independent.

CREATE TABLE IF NOT EXISTS public.esign_fields (
  id              text PRIMARY KEY,
  envelope_id     text NOT NULL
                  REFERENCES public.esign_envelopes(id) ON DELETE CASCADE,
  signer_id       text
                  REFERENCES public.esign_signers(id) ON DELETE SET NULL,
  type            text NOT NULL CHECK (type IN (
    'signature', 'initials', 'text', 'date', 'auto_date',
    'checkbox', 'dropdown'
  )),
  page            integer NOT NULL CHECK (page > 0),
  -- Coordinates as percent of page (0-100), so layout survives rerendering.
  x               numeric(8, 4) NOT NULL,
  y               numeric(8, 4) NOT NULL,
  width           numeric(8, 4) NOT NULL,
  height          numeric(8, 4) NOT NULL,
  required        boolean NOT NULL DEFAULT true,
  value           text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- validation, format, etc
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS esign_fields_envelope_page_idx
  ON public.esign_fields (envelope_id, page);

CREATE INDEX IF NOT EXISTS esign_fields_signer_idx
  ON public.esign_fields (signer_id);

-- ── Audit events ────────────────────────────────────────────────────────────
-- The legal evidence trail. WORM (write-once, read-many) by convention —
-- there is no UPDATE or DELETE statement against this table anywhere in
-- application code. The Phase 6.7 ZIP export reads from here.

CREATE TABLE IF NOT EXISTS public.esign_audit_events (
  id              bigserial PRIMARY KEY,
  envelope_id     text NOT NULL,
  -- 'sender_user' | 'signer' | 'system' | 'witness'
  actor_type      text NOT NULL CHECK (actor_type IN ('sender_user', 'signer', 'system', 'witness')),
  actor_id        text,
  email           text,
  action          text NOT NULL,
  ip              text,
  user_agent      text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

-- Hot read paths:
--   • Single-envelope timeline view:  WHERE envelope_id = ? ORDER BY occurred_at
--   • Global searchable audit (P7.3): WHERE email = ? OR action = ? ORDER BY occurred_at
CREATE INDEX IF NOT EXISTS esign_audit_envelope_time_idx
  ON public.esign_audit_events (envelope_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS esign_audit_email_time_idx
  ON public.esign_audit_events (email, occurred_at DESC)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS esign_audit_action_time_idx
  ON public.esign_audit_events (action, occurred_at DESC);

-- ── Certificates ────────────────────────────────────────────────────────────
-- One row per envelope once completed. `pdf_storage_path` points at the
-- sealed PDF in Supabase Storage. `evidence_json` is the renderable
-- evidence pack (Phase 6.3).

CREATE TABLE IF NOT EXISTS public.esign_certificates (
  envelope_id        text PRIMARY KEY
                     REFERENCES public.esign_envelopes(id) ON DELETE CASCADE,
  pdf_storage_path   text NOT NULL,
  pdf_hash           text NOT NULL,        -- sha256 of the sealed PDF
  certificate_hash   text NOT NULL,        -- sha256 of the evidence pack
  evidence_json      jsonb NOT NULL,
  -- Phase 6.1: tamper-evident signature (PAdES). NULL until 6.1 ships.
  pades_signature    bytea,
  signed_with_kid    text,                  -- KMS key id used (when sealed)
  issued_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS esign_certificates_pdf_hash_idx
  ON public.esign_certificates (pdf_hash);

-- ── updated_at triggers ─────────────────────────────────────────────────────
-- Keep `updated_at` honest without trusting the application layer.

CREATE OR REPLACE FUNCTION public.tg_esign_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'esign_envelopes_set_updated_at'
  ) THEN
    CREATE TRIGGER esign_envelopes_set_updated_at
      BEFORE UPDATE ON public.esign_envelopes
      FOR EACH ROW EXECUTE FUNCTION public.tg_esign_set_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'esign_signers_set_updated_at'
  ) THEN
    CREATE TRIGGER esign_signers_set_updated_at
      BEFORE UPDATE ON public.esign_signers
      FOR EACH ROW EXECUTE FUNCTION public.tg_esign_set_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'esign_fields_set_updated_at'
  ) THEN
    CREATE TRIGGER esign_fields_set_updated_at
      BEFORE UPDATE ON public.esign_fields
      FOR EACH ROW EXECUTE FUNCTION public.tg_esign_set_updated_at();
  END IF;
END $$;

-- ── RLS — Phase 6.9 prep ────────────────────────────────────────────────────
-- We enable RLS now but with a permissive default policy (service role only)
-- so the application keeps working. Phase 6.9 will tighten this to
-- per-firm policies; the table structure already supports it via firm_id.

ALTER TABLE public.esign_envelopes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_signers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_fields         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_audit_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_certificates   ENABLE ROW LEVEL SECURITY;

-- Service-role bypass policy (the application uses the service role key
-- for backend access). Per-firm policies for anon/authenticated roles
-- land in Phase 6.9.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'esign_envelopes',
      'esign_signers',
      'esign_fields',
      'esign_audit_events',
      'esign_certificates'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
      t || '_service_role_full',
      t
    );
  END LOOP;
EXCEPTION
  WHEN duplicate_object THEN
    -- Policies already exist (migration re-run) — fine.
    NULL;
END $$;

COMMIT;
