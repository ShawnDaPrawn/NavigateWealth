-- =============================================================================
-- Appointment Booking — enum values (Phase 1, migration A)
-- =============================================================================
--
-- Adds the enum values the appointment booking flow needs. Kept separate from
-- the table migration because Postgres forbids USING a newly added enum value
-- inside the same transaction that adds it.
--
-- Live-schema notes (verified against production):
--   • events.event_type    is enum (meeting, review, call, webinar, internal, other)
--   • events.location_type is enum (in_person, video, phone, other) — the
--     application's Zod default is 'virtual', which is NOT in the enum, so any
--     insert relying on that default fails. Adding 'virtual' fixes that latent
--     mismatch as well as serving the appointment flow.
--
-- The events table itself was created out-of-band (no repo migration), so both
-- statements are guarded: they no-op on a database where the enums don't exist.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
    ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'appointment';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_type') THEN
    ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'virtual';
  END IF;
END $$;
