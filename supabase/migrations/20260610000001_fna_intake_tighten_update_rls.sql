-- Security fix (SECURITY-AUDIT H-12): tighten the client UPDATE policy on
-- fna_intake_sessions.
--
-- The previous policy allowed UPDATE when status IN ('client_draft','submitted'),
-- so a client could edit — or roll back — a session the adviser had already
-- received (submitted -> client_draft -> resubmit with different data).
--
-- Fix: the USING clause now only matches rows still in 'client_draft', so a
-- submitted session can no longer be targeted by a client UPDATE at all. The
-- WITH CHECK still permits the legitimate draft -> submitted transition (and
-- continued draft edits). The Edge Function uses the service role, which
-- bypasses RLS, so server-side state changes are unaffected.

BEGIN;

DROP POLICY IF EXISTS fna_intake_client_update_draft ON public.fna_intake_sessions;
CREATE POLICY fna_intake_client_update_draft ON public.fna_intake_sessions
  FOR UPDATE
  USING (auth.uid() = client_id AND status = 'client_draft')
  WITH CHECK (auth.uid() = client_id AND status IN ('client_draft', 'submitted'));

COMMIT;
