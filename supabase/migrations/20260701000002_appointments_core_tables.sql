-- =============================================================================
-- Appointment Booking — core tables (Phase 1, migration B)
-- =============================================================================
--
-- Three tables backing the client-facing appointment flow:
--
--   • appointments                     — 1:1 extension of an events row holding
--     appointment-only state: client snapshot, meeting link, ICS identity
--     (UID/SEQUENCE), the public manage token, and lifecycle status. Kept OFF
--     the events table because calendar-service selects events with
--     `select('*')` straight into the browser — the manage token must never
--     ride along — and because ICS/email state is meaningless for the other
--     event types.
--
--   • appointment_emails               — the scheduled-send queue. A pg_cron
--     job drains due rows every minute; the partial unique index guarantees at
--     most one live (pending/processing) row per (appointment, email type), so
--     sends are idempotent even if the cron overlaps itself.
--
--   • appointment_reschedule_requests  — client-proposed new times captured on
--     the public manage page, surfaced to the advisor for rebooking.
--
-- The events table was created out-of-band (no repo migration), so the FK to
-- it is added conditionally — a fresh shadow database without events still
-- applies this migration cleanly.
-- =============================================================================

BEGIN;

-- ── Appointments ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appointments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                 uuid NOT NULL UNIQUE,
  -- Client snapshot at booking time. client_id is the auth user id; the
  -- name/email copies keep emails working even if the profile changes later.
  client_id                uuid,
  client_email             text NOT NULL,
  client_name              text NOT NULL,
  timezone                 text NOT NULL DEFAULT 'Africa/Johannesburg',
  meeting_kind             text NOT NULL DEFAULT 'virtual'
                           CHECK (meeting_kind IN ('virtual', 'in_person', 'phone')),
  join_url                 text,
  location                 text,
  -- 'manual' = advisor pasted the link; 'ms_teams' reserved for Phase 2 Graph
  -- integration.
  meeting_provider         text NOT NULL DEFAULT 'manual',
  -- ICS identity: UID stays stable for the appointment's lifetime; SEQUENCE
  -- increments on every reschedule so calendar clients replace, not duplicate.
  ics_uid                  text NOT NULL,
  ics_sequence             integer NOT NULL DEFAULT 0,
  -- Public manage-page token (reschedule/cancel, no login). Stable across
  -- reschedules so links in older emails keep working; only the expiry moves.
  manage_token             text NOT NULL UNIQUE,
  manage_token_expires_at  timestamptz NOT NULL,
  status                   text NOT NULL DEFAULT 'confirmed'
                           CHECK (status IN ('confirmed', 'reschedule_requested',
                                             'cancelled', 'completed')),
  cancelled_at             timestamptz,
  created_by               uuid NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Events exists only out-of-band; attach the FK when it's there.
DO $$
BEGIN
  IF to_regclass('public.events') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'appointments_event_id_fkey'
     ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS appointments_created_by_idx
  ON public.appointments (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS appointments_client_idx
  ON public.appointments (client_id);

-- ── Scheduled email queue ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appointment_emails (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid NOT NULL
                  REFERENCES public.appointments(id) ON DELETE CASCADE,
  email_type      text NOT NULL CHECK (email_type IN (
    'confirmation', 'day_before', 'morning_of', 'starting_soon',
    'rescheduled', 'cancelled', 'reschedule_requested_advisor'
  )),
  scheduled_at    timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'sent', 'failed', 'cancelled', 'skipped'
  )),
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- At most ONE live row per (appointment, type); terminal rows (sent /
-- cancelled / skipped / failed) remain as history.
CREATE UNIQUE INDEX IF NOT EXISTS appointment_emails_one_live_idx
  ON public.appointment_emails (appointment_id, email_type)
  WHERE status IN ('pending', 'processing');

-- Cron drain path: WHERE status = 'pending' AND scheduled_at <= now()
CREATE INDEX IF NOT EXISTS appointment_emails_due_idx
  ON public.appointment_emails (scheduled_at)
  WHERE status = 'pending';

-- ── Reschedule requests ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appointment_reschedule_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid NOT NULL
                  REFERENCES public.appointments(id) ON DELETE CASCADE,
  -- [{ "start_at": iso, "end_at": iso }, ...] — at most 3, validated in app.
  proposed_times  jsonb NOT NULL DEFAULT '[]'::jsonb,
  note            text,
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid
);

CREATE INDEX IF NOT EXISTS appointment_reschedule_requests_open_idx
  ON public.appointment_reschedule_requests (appointment_id)
  WHERE status = 'open';

-- ── updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_appointments_set_updated_at()
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
    SELECT 1 FROM pg_trigger WHERE tgname = 'appointments_set_updated_at'
  ) THEN
    CREATE TRIGGER appointments_set_updated_at
      BEFORE UPDATE ON public.appointments
      FOR EACH ROW EXECUTE FUNCTION public.tg_appointments_set_updated_at();
  END IF;
END $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Service-role-only, same posture as the esign tables: all access goes through
-- edge functions using the service client, with created_by ownership checks in
-- application code.

ALTER TABLE public.appointments                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_emails              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reschedule_requests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'appointments',
      'appointment_emails',
      'appointment_reschedule_requests'
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
    NULL;
END $$;

COMMIT;
