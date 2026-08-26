-- ============================================================================
-- Close two RLS bypasses and the over-broad table grants that back them
-- ============================================================================
--
-- Groundwork for moving entity data out of `kv_store_91ed8379` into the
-- relational tables that already exist. Those destination tables have RLS
-- policies written, but two of them do not hold. Moving data into a table
-- whose policies do not hold would take records that are safe today — KV is
-- reachable only by the service role — and publish them.
--
-- Nothing in the SPA queries a table directly. Every table read in this
-- codebase happens inside the Edge Function on the service role, which has
-- rolbypassrls and is unaffected by everything below. Verified: zero
-- `.from('<table>')` calls outside `src/supabase/functions/`, and the SPA's
-- Supabase client is used only for `auth.getSession()`.
--
--
-- 1. personal_client_applications — RLS was effectively off
-- ------------------------------------------------------------------------
-- Two policies, "Allow service role full access" and "Service role can do
-- anything on applications", were `FOR ALL USING (true) WITH CHECK (true)`
-- and, despite the names, were not restricted `TO` any role — so they applied
-- to `public`, which is every role RLS evaluates. PERMISSIVE policies are
-- OR'd, so those two subsumed the four client-scoped policies beside them:
-- `anon` and `authenticated` could SELECT, INSERT, UPDATE and DELETE every
-- row over PostgREST.
--
-- The table holds 0 rows today, so nothing was exposed. It is also the
-- destination for the 192 `application:` records still in KV, which is what
-- makes this the first thing to fix rather than a tidy-up.
--
-- The service role never needed either policy: it bypasses RLS entirely.
--
-- 2. tasks — "Admin users can …" policies that never checked for an admin
-- ------------------------------------------------------------------------
-- All four gated on `auth.uid() IS NOT NULL`, i.e. "is signed in". Any
-- authenticated user, a client included, could read, update and delete every
-- task over PostgREST.
--
-- Replaced with the creator/assignee shape the sibling `reminders` table
-- already uses — same columns, same intent — rather than inventing a new one.
-- The names now say what the policies do.
--
-- 3. Over-broad grants
-- ------------------------------------------------------------------------
-- Every table below granted the full set — including TRUNCATE — to `anon` and
-- `authenticated`, courtesy of the project-wide ALTER DEFAULT PRIVILEGES.
-- TRUNCATE is the one table privilege RLS does not gate: a policy set can be
-- perfect and TRUNCATE still empties the table.
--
-- This was not reachable: `anon` and `authenticated` are NOLOGIN roles entered
-- only via PostgREST, which exposes no TRUNCATE verb. It is removed as least
-- privilege, and because the previous lesson on this project was that a
-- half-revoked grant looks exactly like a fixed one — see
-- 20260825004035_revoke_public_execute_on_definer_helpers.sql.
--
-- `kv_store_91ed8379` gets ALL revoked rather than a subset: it carries zero
-- policies by design (RLS on, no policies, service role only), so no grant to
-- anon or authenticated has any legitimate use.
-- ============================================================================

-- ── 1. personal_client_applications ─────────────────────────────────────────
drop policy if exists "Allow service role full access" on public.personal_client_applications;
drop policy if exists "Service role can do anything on applications" on public.personal_client_applications;

-- ── 2. tasks ────────────────────────────────────────────────────────────────
drop policy if exists "Admin users can view all tasks" on public.tasks;
drop policy if exists "Admin users can insert tasks" on public.tasks;
drop policy if exists "Admin users can update tasks" on public.tasks;
drop policy if exists "Admin users can delete tasks" on public.tasks;

create policy "Creator or assignee can view a task"
  on public.tasks for select
  using (auth.uid() = assignee_id or auth.uid() = created_by);

create policy "Creator can insert a task"
  on public.tasks for insert
  with check (auth.uid() = created_by);

create policy "Creator or assignee can update a task"
  on public.tasks for update
  using (auth.uid() = assignee_id or auth.uid() = created_by)
  with check (auth.uid() = assignee_id or auth.uid() = created_by);

create policy "Creator can delete a task"
  on public.tasks for delete
  using (auth.uid() = created_by);

-- ── 3. grants ───────────────────────────────────────────────────────────────
revoke all on table public.kv_store_91ed8379 from anon, authenticated;

revoke truncate, references, trigger on table
  public.clients,
  public.tasks,
  public.events,
  public.reminders,
  public.personal_client_applications,
  public.fna_intake_sessions
from anon, authenticated;

-- Stop new tables from silently re-acquiring what was just removed. This
-- covers tables created by `postgres`, which is every table a migration
-- creates.
--
-- It does NOT close the hole completely, and saying so is the point: there is
-- a second default-ACL entry owned by `supabase_admin` granting the same set,
-- and that role is platform-managed rather than ours to alter. A table created
-- by `supabase_admin` still arrives with TRUNCATE granted to anon. Verify any
-- new table with:
--
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema='public' and table_name='<new table>'
--     and grantee in ('anon','authenticated');
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
