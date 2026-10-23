-- ============================================================================
-- RLS policies: evaluate auth.uid() once per statement, not once per row
-- ============================================================================
--
-- Closes GitHub #378 (performance advisor `auth_rls_initplan`, 22 findings).
--
-- Every policy below compared a column to a bare `auth.uid()`. Postgres treats
-- that as a per-row function call, so a scan of N rows calls it N times.
-- Wrapped as `(select auth.uid())` it becomes an InitPlan: evaluated once per
-- statement and reused. See
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- Behaviour-preserving. `ALTER POLICY` keeps each policy's name, command,
-- roles and PERMISSIVE flag; only the USING / WITH CHECK expressions are
-- rewritten, and each one tests exactly what it tested before. A policy that
-- had no WITH CHECK still has none (UPDATE falls back to USING).
--
-- Nothing in the product reaches these tables through RLS today: every read
-- and write happens in the Edge Function on the service role, which bypasses
-- RLS. The policies guard direct PostgREST access with a user's JWT, which is
-- exactly the path they keep guarding.
--
-- Also adds the covering index for `personal_client_applications_reviewed_by_fkey`
-- (advisor `unindexed_foreign_keys`, INFO), named and IF NOT EXISTS per rule 1
-- of supabase/migrations/README.md. The table is empty, so the build is instant.
-- ============================================================================

-- clients -------------------------------------------------------------------
alter policy "Users can view their own clients" on public.clients
  using ((select auth.uid()) = created_by);
alter policy "Users can insert their own clients" on public.clients
  with check ((select auth.uid()) = created_by);
alter policy "Users can update their own clients" on public.clients
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);
alter policy "Users can delete their own clients" on public.clients
  using ((select auth.uid()) = created_by);

-- events --------------------------------------------------------------------
alter policy "Users can view their events" on public.events
  using ((select auth.uid()) = created_by);
alter policy "Users can insert events" on public.events
  with check ((select auth.uid()) = created_by);
alter policy "Users can update their events" on public.events
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);
alter policy "Users can delete their events" on public.events
  using ((select auth.uid()) = created_by);

-- reminders -----------------------------------------------------------------
alter policy "Users can view their reminders" on public.reminders
  using (((select auth.uid()) = assignee_id) or ((select auth.uid()) = created_by));
alter policy "Users can insert reminders" on public.reminders
  with check (((select auth.uid()) = created_by) and ((select auth.uid()) = assignee_id));
alter policy "Users can update their reminders" on public.reminders
  using (((select auth.uid()) = assignee_id) or ((select auth.uid()) = created_by))
  with check (((select auth.uid()) = assignee_id) or ((select auth.uid()) = created_by));
alter policy "Users can delete their reminders" on public.reminders
  using ((select auth.uid()) = created_by);

-- tasks ---------------------------------------------------------------------
alter policy "Creator or assignee can view a task" on public.tasks
  using (((select auth.uid()) = assignee_id) or ((select auth.uid()) = created_by));
alter policy "Creator can insert a task" on public.tasks
  with check ((select auth.uid()) = created_by);
alter policy "Creator or assignee can update a task" on public.tasks
  using (((select auth.uid()) = assignee_id) or ((select auth.uid()) = created_by))
  with check (((select auth.uid()) = assignee_id) or ((select auth.uid()) = created_by));
alter policy "Creator can delete a task" on public.tasks
  using ((select auth.uid()) = created_by);

-- fna_intake_sessions -------------------------------------------------------
alter policy "fna_intake_client_select" on public.fna_intake_sessions
  using ((select auth.uid()) = client_id);
alter policy "fna_intake_client_update_draft" on public.fna_intake_sessions
  using (((select auth.uid()) = client_id) and (status = 'client_draft'::text))
  with check (((select auth.uid()) = client_id) and (status = 'client_draft'::text));

-- personal_client_applications ----------------------------------------------
alter policy "Clients can view own application" on public.personal_client_applications
  using ((select auth.uid()) = user_id);
alter policy "Clients can insert own application" on public.personal_client_applications
  with check ((select auth.uid()) = user_id);
alter policy "Clients can update own application while in progress" on public.personal_client_applications
  using (((select auth.uid()) = user_id) and (status = any (array['in_progress'::text, 'declined'::text])));
alter policy "Clients can delete own application while in progress" on public.personal_client_applications
  using (((select auth.uid()) = user_id) and (status = 'in_progress'::text));

create index if not exists idx_personal_client_applications_reviewed_by
  on public.personal_client_applications (reviewed_by);
