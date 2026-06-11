-- SECURITY-AUDIT H-12: clients could still UPDATE a session after submitting
-- it (policy allowed status IN ('client_draft','submitted')), letting them
-- mutate data the adviser was already reviewing. Restrict client updates to
-- drafts only; submission and all post-submission transitions go through the
-- Edge Function (service role), which bypasses RLS.
BEGIN;

DROP POLICY IF EXISTS fna_intake_client_update_draft ON public.fna_intake_sessions;
CREATE POLICY fna_intake_client_update_draft ON public.fna_intake_sessions
  FOR UPDATE
  USING (auth.uid() = client_id AND status = 'client_draft')
  WITH CHECK (auth.uid() = client_id AND status = 'client_draft');

COMMIT;
