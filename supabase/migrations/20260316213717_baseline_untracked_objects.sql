-- ============================================================================
-- BASELINE — objects that exist in production but were NEVER created by a
-- migration. Reconciled from live introspection on 2026-08-24.
--
-- WHY THIS FILE EXISTS
-- --------------------
-- `supabase_migrations.schema_migrations` records three versions. Production
-- contains seven tables, six enum types, eight triggers and eight functions.
-- Everything in this file is the difference: created through the dashboard SQL
-- editor or through the `setup.ts` bootstrap routes, and therefore invisible to
-- version control until now. Without it there is no way to rebuild this
-- database — no staging, no disaster recovery, no reviewable schema change.
--
-- RECONSTRUCTED? YES — and that matters, so read this before trusting it.
-- The three sibling files carry SQL copied verbatim from what production ran.
-- This one cannot: there is no recorded statement to copy. It was rebuilt from
-- pg_catalog (pg_attribute, pg_constraint, pg_index, pg_policies, pg_trigger,
-- pg_proc, pg_enum), so columns, types, defaults, nullability, constraints,
-- indexes, RLS policies, triggers and function bodies are all faithful to the
-- live database. What introspection CANNOT recover is intent: the original
-- ordering, any data backfills that ran alongside, and anything since dropped.
-- Treat it as an accurate photograph of the schema, not as the original history.
--
-- IDEMPOTENT BY CONSTRUCTION. Every statement is guarded, so applying this to
-- production is a no-op and applying it to an empty database rebuilds it. It is
-- stamped 20260316213717 — immediately before the kv-store migration — so a
-- fresh rebuild creates these objects first.
--
-- STAMPING IT DOES NOT MAKE IT TRUE HISTORY. These objects predate nothing and
-- postdate nothing in particular; the timestamp only fixes rebuild order.
-- ============================================================================

BEGIN;

-- ── Extensions ──────────────────────────────────────────────────────────────
-- personal_client_applications.id defaults to uuid_generate_v4(); every other
-- table uses the built-in gen_random_uuid(). Recorded, not harmonised.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enum types ──────────────────────────────────────────────────────────────
-- Postgres has no CREATE TYPE IF NOT EXISTS, hence the exception guards.
DO $$ BEGIN
  CREATE TYPE public.event_status AS ENUM ('scheduled','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_type AS ENUM ('meeting','review','call','webinar','internal','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.location_type AS ENUM ('in_person','video','phone','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reminder_priority AS ENUM ('low','normal','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reminder_status AS ENUM ('pending','completed','overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reminder_type AS ENUM ('client_review','section_14','birthday','follow_up','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Shared trigger functions ────────────────────────────────────────────────
-- ⚠️ Every function below is reproduced WITHOUT `SET search_path`, exactly as
-- production has it. Supabase's own linter flags all of them
-- (0011_function_search_path_mutable), and three are SECURITY DEFINER reachable
-- by the `anon` role over PostgREST. Recorded as-is; remediation is a separate
-- forward migration — see README.md §"Open remediation".

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_tasks_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_task_completed_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_application_submitted_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') AND NEW.submitted_at IS NULL THEN
    NEW.submitted_at = NOW();
  END IF;

  IF NEW.status IN ('approved', 'declined') AND (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'declined')) AND NEW.reviewed_at IS NULL THEN
    NEW.reviewed_at = NOW();
  END IF;

  RETURN NEW;
END;
$function$;

-- ── clients ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id             uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name      text NOT NULL,
  preferred_name text,
  email          text NOT NULL,
  phone          text,
  date_of_birth  date,
  created_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_clients_email      ON public.clients USING btree (email);
CREATE INDEX IF NOT EXISTS idx_clients_full_name  ON public.clients USING btree (full_name);

DROP TRIGGER IF EXISTS update_clients_updated_at ON public.clients;
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
CREATE POLICY "Users can view their own clients" ON public.clients
  FOR SELECT USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can insert their own clients" ON public.clients;
CREATE POLICY "Users can insert their own clients" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
CREATE POLICY "Users can update their own clients" ON public.clients
  FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
CREATE POLICY "Users can delete their own clients" ON public.clients
  FOR DELETE USING (auth.uid() = created_by);

-- ── tasks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id                uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title             text NOT NULL,
  description       text,
  status            text NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new','in_progress','completed','archived')),
  priority          text NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low','medium','high','critical')),
  is_template       boolean NOT NULL DEFAULT false,
  due_date          timestamptz,
  assignee_initials text,
  assignee_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags              text[] DEFAULT '{}'::text[],
  category          text CHECK (category IN ('client','compliance','application','internal')),
  created_by        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  sort_order        integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_status      ON public.tasks USING btree (status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by  ON public.tasks USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks USING btree (assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sort_order  ON public.tasks USING btree (status, sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date    ON public.tasks USING btree (due_date) WHERE (due_date IS NOT NULL);

DROP TRIGGER IF EXISTS tasks_updated_at_trigger ON public.tasks;
CREATE TRIGGER tasks_updated_at_trigger BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_tasks_updated_at();

DROP TRIGGER IF EXISTS tasks_completed_at_trigger ON public.tasks;
CREATE TRIGGER tasks_completed_at_trigger BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_completed_at();

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ⚠️ Recorded as-is: these four policies gate on "is anybody signed in"
-- (auth.uid() IS NOT NULL), NOT on role. Any authenticated user — including a
-- client — satisfies them over PostgREST. Named "Admin users can …", which is
-- what they were intended to mean, not what they enforce.
DROP POLICY IF EXISTS "Admin users can view all tasks" ON public.tasks;
CREATE POLICY "Admin users can view all tasks" ON public.tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin users can insert tasks" ON public.tasks;
CREATE POLICY "Admin users can insert tasks" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "Admin users can update tasks" ON public.tasks;
CREATE POLICY "Admin users can update tasks" ON public.tasks
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin users can delete tasks" ON public.tasks;
CREATE POLICY "Admin users can delete tasks" ON public.tasks
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── reminders ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reminders (
  id              uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title           text NOT NULL,
  description     text,
  type            public.reminder_type NOT NULL DEFAULT 'other',
  status          public.reminder_status NOT NULL DEFAULT 'pending',
  due_at          timestamptz NOT NULL,
  priority        public.reminder_priority NOT NULL DEFAULT 'normal',
  client_id       uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  assignee_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at    timestamptz,
  recurrence_rule text,
  tags            text[] DEFAULT '{}'::text[],
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_assignee_id ON public.reminders USING btree (assignee_id);
CREATE INDEX IF NOT EXISTS idx_reminders_client_id   ON public.reminders USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_reminders_created_by  ON public.reminders USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_reminders_due_at      ON public.reminders USING btree (due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_priority    ON public.reminders USING btree (priority);
CREATE INDEX IF NOT EXISTS idx_reminders_status      ON public.reminders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_reminders_type        ON public.reminders USING btree (type);
CREATE INDEX IF NOT EXISTS idx_reminders_tags        ON public.reminders USING gin (tags);

DROP TRIGGER IF EXISTS update_reminders_updated_at ON public.reminders;
CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their reminders" ON public.reminders;
CREATE POLICY "Users can view their reminders" ON public.reminders
  FOR SELECT USING (auth.uid() = assignee_id OR auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can insert reminders" ON public.reminders;
CREATE POLICY "Users can insert reminders" ON public.reminders
  FOR INSERT WITH CHECK (auth.uid() = created_by AND auth.uid() = assignee_id);

DROP POLICY IF EXISTS "Users can update their reminders" ON public.reminders;
CREATE POLICY "Users can update their reminders" ON public.reminders
  FOR UPDATE USING (auth.uid() = assignee_id OR auth.uid() = created_by)
  WITH CHECK (auth.uid() = assignee_id OR auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their reminders" ON public.reminders;
CREATE POLICY "Users can delete their reminders" ON public.reminders
  FOR DELETE USING (auth.uid() = created_by);

-- ── events ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id             uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title          text NOT NULL,
  description    text,
  event_type     public.event_type NOT NULL DEFAULT 'meeting',
  start_at       timestamptz NOT NULL,
  end_at         timestamptz NOT NULL,
  location_type  public.location_type NOT NULL DEFAULT 'in_person',
  location       text,
  video_link     text,
  status         public.event_status NOT NULL DEFAULT 'scheduled',
  client_id      uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  attendee_count integer NOT NULL DEFAULT 0,
  attendees      jsonb DEFAULT '{}'::jsonb,
  created_by     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_event_times CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_events_client_id     ON public.events USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by    ON public.events USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_events_end_at        ON public.events USING btree (end_at);
CREATE INDEX IF NOT EXISTS idx_events_event_type    ON public.events USING btree (event_type);
CREATE INDEX IF NOT EXISTS idx_events_location_type ON public.events USING btree (location_type);
CREATE INDEX IF NOT EXISTS idx_events_start_at      ON public.events USING btree (start_at);
CREATE INDEX IF NOT EXISTS idx_events_status        ON public.events USING btree (status);

DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their events" ON public.events;
CREATE POLICY "Users can view their events" ON public.events
  FOR SELECT USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can insert events" ON public.events;
CREATE POLICY "Users can insert events" ON public.events
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their events" ON public.events;
CREATE POLICY "Users can update their events" ON public.events
  FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their events" ON public.events;
CREATE POLICY "Users can delete their events" ON public.events
  FOR DELETE USING (auth.uid() = created_by);

-- ── personal_client_applications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personal_client_applications (
  id               uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'in_progress'
                     CHECK (status IN ('in_progress','submitted','approved','declined')),
  application_data jsonb DEFAULT '{}'::jsonb,
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  reviewed_by      uuid REFERENCES auth.users(id),
  review_notes     text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

COMMENT ON TABLE public.personal_client_applications IS
  'Manages Personal Client onboarding applications. One application per user. Data is copied to actual profile tables on approval.';
COMMENT ON COLUMN public.personal_client_applications.status IS
  'Application workflow status: in_progress → submitted → approved/declined';
COMMENT ON COLUMN public.personal_client_applications.application_data IS
  'JSONB containing all form data matching Personal Profile UI structure';
COMMENT ON COLUMN public.personal_client_applications.reviewed_by IS
  'User ID of admin who approved/declined the application';

CREATE INDEX IF NOT EXISTS idx_personal_client_applications_user_id      ON public.personal_client_applications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_personal_client_applications_status       ON public.personal_client_applications USING btree (status);
CREATE INDEX IF NOT EXISTS idx_personal_client_applications_submitted_at ON public.personal_client_applications USING btree (submitted_at);

DROP TRIGGER IF EXISTS update_personal_client_applications_updated_at ON public.personal_client_applications;
CREATE TRIGGER update_personal_client_applications_updated_at BEFORE UPDATE ON public.personal_client_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS auto_set_application_timestamps ON public.personal_client_applications;
CREATE TRIGGER auto_set_application_timestamps BEFORE UPDATE ON public.personal_client_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_application_submitted_at();

ALTER TABLE public.personal_client_applications ENABLE ROW LEVEL SECURITY;

-- ⚠️ Recorded as-is: TWO overlapping `FOR ALL USING (true)` policies. Their
-- names say "service role", but neither is restricted TO a role — they are
-- granted to `public`, so USING (true) is satisfied by any caller RLS applies
-- to. The service role bypasses RLS entirely and never needed them.
DROP POLICY IF EXISTS "Allow service role full access" ON public.personal_client_applications;
CREATE POLICY "Allow service role full access" ON public.personal_client_applications
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can do anything on applications" ON public.personal_client_applications;
CREATE POLICY "Service role can do anything on applications" ON public.personal_client_applications
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Clients can view own application" ON public.personal_client_applications;
CREATE POLICY "Clients can view own application" ON public.personal_client_applications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clients can insert own application" ON public.personal_client_applications;
CREATE POLICY "Clients can insert own application" ON public.personal_client_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clients can update own application while in progress" ON public.personal_client_applications;
CREATE POLICY "Clients can update own application while in progress" ON public.personal_client_applications
  FOR UPDATE USING (auth.uid() = user_id AND status IN ('in_progress','declined'));

DROP POLICY IF EXISTS "Clients can delete own application while in progress" ON public.personal_client_applications;
CREATE POLICY "Clients can delete own application while in progress" ON public.personal_client_applications
  FOR DELETE USING (auth.uid() = user_id AND status = 'in_progress');

-- ── Reporting helpers (SECURITY DEFINER) ────────────────────────────────────
-- ⚠️ All three are SECURITY DEFINER, have a mutable search_path, and carry no
-- EXECUTE revocation — so `anon` and `authenticated` can both call them over
-- /rest/v1/rpc/. They filter on auth.uid(), so an anonymous call returns no
-- rows; the exposure is the definer-rights + mutable-search_path pairing, not
-- the data. Contrast 20260821210412, which revokes and pins search_path.

CREATE OR REPLACE FUNCTION public.get_reminders_due_today()
RETURNS TABLE(id uuid, title text, description text, type public.reminder_type, status public.reminder_status, due_at timestamptz, priority public.reminder_priority, client_id uuid, assignee_id uuid, created_by uuid, completed_at timestamptz, recurrence_rule text, tags text[], created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  RETURN QUERY
  SELECT r.*
  FROM reminders r
  WHERE DATE(r.due_at) = CURRENT_DATE
    AND r.status = 'pending'
    AND (r.assignee_id = auth.uid() OR r.created_by = auth.uid())
  ORDER BY r.due_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_upcoming_reminders(days_ahead integer DEFAULT 7)
RETURNS TABLE(id uuid, title text, description text, type public.reminder_type, status public.reminder_status, due_at timestamptz, priority public.reminder_priority, client_id uuid, assignee_id uuid, created_by uuid, completed_at timestamptz, recurrence_rule text, tags text[], created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  RETURN QUERY
  SELECT r.*
  FROM reminders r
  WHERE r.due_at BETWEEN NOW() AND (NOW() + (days_ahead || ' days')::INTERVAL)
    AND r.status = 'pending'
    AND (r.assignee_id = auth.uid() OR r.created_by = auth.uid())
  ORDER BY r.due_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_events_today()
RETURNS TABLE(id uuid, title text, description text, event_type public.event_type, start_at timestamptz, end_at timestamptz, location_type public.location_type, location text, video_link text, status public.event_status, client_id uuid, attendee_count integer, attendees jsonb, created_by uuid, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  RETURN QUERY
  SELECT e.*
  FROM events e
  WHERE DATE(e.start_at) = CURRENT_DATE
    AND e.status = 'scheduled'
    AND e.created_by = auth.uid()
  ORDER BY e.start_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_overdue_reminders()
RETURNS void LANGUAGE plpgsql AS $function$
BEGIN
  UPDATE reminders
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_at < NOW()
    AND status != 'completed';
END;
$function$;

COMMIT;
