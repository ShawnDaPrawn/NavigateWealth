-- ============================================================================
-- APPLIED IN PRODUCTION as version 20260522225558 (name: fna_intake_sessions)
--
-- RECONSTRUCTED? NO. Body copied verbatim from
-- `supabase_migrations.schema_migrations.statements` on 2026-08-24.
--
-- STAMP CORRECTION: this repo previously carried the same migration as
-- `20260520000001_fna_intake_sessions.sql`. That filename was never the applied
-- version — production recorded 20260522225558, presumably because the SQL was
-- run through the dashboard rather than `supabase db push`. The mis-stamped file
-- has been deleted and replaced by this one so that filename == applied version.
--
-- ---------------------------------------------------------------------------
-- ℹ️  THE UPDATE POLICY BELOW IS SUPERSEDED — AND THE REPLACEMENT IS APPLIED.
--
-- `fna_intake_client_update_draft` as written here permitted a client to UPDATE
-- their own session while status IN ('client_draft','submitted'), with a WITH
-- CHECK that constrained only ownership — not status. A client could therefore
-- mutate an FNA the adviser had already begun reviewing, and move a 'submitted'
-- row to 'accepted', self-accepting their own Financial Needs Analysis.
--
-- That was SECURITY-AUDIT H-12. The fix is
-- `20260824222932_fna_intake_rls_draft_only.sql`, APPLIED to production on
-- 2026-08-24 and verified: USING and WITH CHECK now both read
-- `(auth.uid() = client_id) AND (status = 'client_draft')`.
--
-- The statement below is retained because this file records what production
-- ran in May, not what is in force today. Do not "fix" it here — read the
-- 20260824222932 migration for the policy currently in effect.
-- ---------------------------------------------------------------------------

-- FNA Intake Sessions (Postgres migration — launch blocker)

CREATE TABLE IF NOT EXISTS public.fna_intake_sessions (
  id                   uuid PRIMARY KEY,
  client_id            uuid NOT NULL,
  domain               text NOT NULL CHECK (domain IN (
    'risk', 'medical', 'retirement', 'investment', 'tax', 'estate'
  )),
  status               text NOT NULL CHECK (status IN (
    'client_draft', 'submitted', 'accepted'
  )),
  inputs               jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress_percent     integer NOT NULL DEFAULT 0,
  consent_accepted_at  timestamptz,
  consent_text_version text,
  submitted_at         timestamptz,
  submitted_by         jsonb,
  accepted_at          timestamptz,
  accepted_by          jsonb,
  linked_fna_id        text,
  request_info_at      timestamptz,
  intake_source        text NOT NULL DEFAULT 'client',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fna_intake_sessions IS
  'Client-led FNA intake sessions. Canonical after FNA_INTAKE_READ_FROM=postgres cutover.';

CREATE UNIQUE INDEX IF NOT EXISTS fna_intake_active_per_domain
  ON public.fna_intake_sessions (client_id, domain)
  WHERE status IN ('client_draft', 'submitted');

CREATE INDEX IF NOT EXISTS fna_intake_submitted_queue
  ON public.fna_intake_sessions (submitted_at DESC NULLS LAST)
  WHERE status = 'submitted';

-- NOTE: duplicated statement, preserved verbatim from the applied migration.
-- Harmless only because it carries IF NOT EXISTS — contrast with the kv-table
-- migration, where the same copy-paste without IF NOT EXISTS cost 1.5 GB.
CREATE INDEX IF NOT EXISTS fna_intake_submitted_queue
  ON public.fna_intake_sessions (submitted_at DESC NULLS LAST)
  WHERE status = 'submitted';

CREATE INDEX IF NOT EXISTS fna_intake_client_domain
  ON public.fna_intake_sessions (client_id, domain, updated_at DESC);

CREATE OR REPLACE FUNCTION public.fna_intake_sessions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fna_intake_sessions_updated_at ON public.fna_intake_sessions;
CREATE TRIGGER fna_intake_sessions_updated_at
  BEFORE UPDATE ON public.fna_intake_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.fna_intake_sessions_set_updated_at();

ALTER TABLE public.fna_intake_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fna_intake_client_select ON public.fna_intake_sessions;
CREATE POLICY fna_intake_client_select ON public.fna_intake_sessions
  FOR SELECT
  USING (auth.uid() = client_id);

-- ⚠️ SUPERSEDED BY 20260611000001 (NOT APPLIED) — see banner above.
DROP POLICY IF EXISTS fna_intake_client_update_draft ON public.fna_intake_sessions;
CREATE POLICY fna_intake_client_update_draft ON public.fna_intake_sessions
  FOR UPDATE
  USING (auth.uid() = client_id AND status IN ('client_draft', 'submitted'))
  WITH CHECK (auth.uid() = client_id);
