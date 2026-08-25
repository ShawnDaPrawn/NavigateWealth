-- ============================================================================
-- APPLIED IN PRODUCTION 2026-08-25 as version 20260825004011.
--
-- Closes 9 of Supabase's `0011_function_search_path_mutable` warnings by
-- pinning `SET search_path = public` on every function the linter flagged.
--
-- WHY IT MATTERS: a SECURITY DEFINER function with a mutable search_path runs
-- with the owner's rights while letting the caller influence which schema its
-- unqualified identifiers resolve to. Three of these were also callable by
-- `anon` over /rest/v1/rpc/. They filter on auth.uid(), so an anonymous call
-- returns no rows — the exposure was the definer-rights + mutable-search_path
-- pairing, not the data.
--
-- 20260821210412 already showed the correct shape (search_path pinned, EXECUTE
-- revoked, granted only to service_role); these five trigger functions and four
-- reporting helpers predate it and were never brought up to it.
--
-- Bodies are reproduced verbatim from `pg_get_functiondef` as introspected on
-- 2026-08-24. The ONLY changes are the added `SET search_path` and the grants.
--
-- NOTE: the REVOKEs below did NOT achieve their goal on their own — Postgres
-- grants EXECUTE to PUBLIC by default and anon/authenticated inherit it, so the
-- ACL still read `=X/postgres` afterwards. 20260825004035 revokes PUBLIC
-- itself. Kept here as applied, because that is what ran.
-- ============================================================================

-- ── Trigger functions ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_tasks_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fna_intake_sessions_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_task_completed_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
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
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $function$
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

-- ── Reporting helpers ───────────────────────────────────────────────────────
-- Nothing in the repository calls any of these four (verified by grep across
-- src/ on 2026-08-25). They are kept rather than dropped because a dashboard or
-- ad-hoc query outside this repo may use them; dropping is a separate, explicit
-- decision. EXECUTE is revoked from anon/authenticated so they are no longer
-- reachable over PostgREST.

CREATE OR REPLACE FUNCTION public.get_reminders_due_today()
RETURNS TABLE(id uuid, title text, description text, type reminder_type, status reminder_status, due_at timestamp with time zone, priority reminder_priority, client_id uuid, assignee_id uuid, created_by uuid, completed_at timestamp with time zone, recurrence_rule text, tags text[], created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
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
RETURNS TABLE(id uuid, title text, description text, type reminder_type, status reminder_status, due_at timestamp with time zone, priority reminder_priority, client_id uuid, assignee_id uuid, created_by uuid, completed_at timestamp with time zone, recurrence_rule text, tags text[], created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
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
RETURNS TABLE(id uuid, title text, description text, event_type event_type, start_at timestamp with time zone, end_at timestamp with time zone, location_type location_type, location text, video_link text, status event_status, client_id uuid, attendee_count integer, attendees jsonb, created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
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
RETURNS void LANGUAGE plpgsql SET search_path = public AS $function$
BEGIN
  UPDATE reminders
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_at < NOW()
    AND status != 'completed';
END;
$function$;

REVOKE ALL ON FUNCTION public.get_reminders_due_today() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_upcoming_reminders(integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.get_events_today() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.update_overdue_reminders() FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_reminders_due_today() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_upcoming_reminders(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_events_today() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_overdue_reminders() TO service_role;
