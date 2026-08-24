-- ============================================================================
-- APPLIED IN PRODUCTION 2026-08-24 as version 20260824222932.
--
-- Was carried in this repo as `20260611000001_...` and left UNAPPLIED for ~2.5
-- months while the gap it closes was live. Renamed so filename == applied
-- version. Verified after applying: the UPDATE policy's USING and WITH CHECK
-- both now read `(auth.uid() = client_id) AND (status = 'client_draft')`.
-- ============================================================================

-- SECURITY-AUDIT H-12: clients could still UPDATE a session after submitting
-- it (policy allowed status IN ('client_draft','submitted')), letting them
-- mutate data the adviser was already reviewing. Restrict client updates to
-- drafts only; submission and all post-submission transitions go through the
-- Edge Function (service role), which bypasses RLS.
DROP POLICY IF EXISTS fna_intake_client_update_draft ON public.fna_intake_sessions;
CREATE POLICY fna_intake_client_update_draft ON public.fna_intake_sessions
  FOR UPDATE
  USING (auth.uid() = client_id AND status = 'client_draft')
  WITH CHECK (auth.uid() = client_id AND status = 'client_draft');

