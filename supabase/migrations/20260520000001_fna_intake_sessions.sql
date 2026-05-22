-- =============================================================================
-- FNA Intake Sessions (Postgres migration — launch blocker)
-- Replaces fna-intake:session:* KV keys with indexed, transactional storage.
-- =============================================================================

BEGIN;

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

-- One active intake per client+domain (draft or submitted awaiting accept)
CREATE UNIQUE INDEX IF NOT EXISTS fna_intake_active_per_domain
  ON public.fna_intake_sessions (client_id, domain)
  WHERE status IN ('client_draft', 'submitted');

CREATE INDEX IF NOT EXISTS fna_intake_submitted_queue
  ON public.fna_intake_sessions (submitted_at DESC NULLS LAST)
  WHERE status = 'submitted';

CREATE INDEX IF NOT EXISTS fna_intake_client_domain
  ON public.fna_intake_sessions (client_id, domain, updated_at DESC);

-- updated_at trigger
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

-- RLS: clients read/update own active sessions; service role bypasses for Edge Function
ALTER TABLE public.fna_intake_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fna_intake_client_select ON public.fna_intake_sessions;
CREATE POLICY fna_intake_client_select ON public.fna_intake_sessions
  FOR SELECT
  USING (auth.uid() = client_id);

DROP POLICY IF EXISTS fna_intake_client_update_draft ON public.fna_intake_sessions;
CREATE POLICY fna_intake_client_update_draft ON public.fna_intake_sessions
  FOR UPDATE
  USING (auth.uid() = client_id AND status IN ('client_draft', 'submitted'))
  WITH CHECK (auth.uid() = client_id);

COMMIT;
