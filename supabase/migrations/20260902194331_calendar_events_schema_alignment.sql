-- Calendar: align `events` and its enum types with the application contract.
--
-- WHY
-- ---
-- `POST /calendar/events` passed Zod validation and then failed at the INSERT,
-- surfacing as the "Failed to create event" toast on every single attempt.
-- Three independent mismatches between the app contract and this database:
--
--   1. `calendar-service.ts::createEvent` always sends `recurrence_rule`, but
--      `events` never had that column (only `reminders` does). PostgREST
--      rejects the whole insert with PGRST204 / 42703, so EVERY create failed
--      regardless of what the user typed. This is the primary bug.
--
--   2. The New Event form offers "Virtual" as a Location Type and submits
--      `virtual`, but `location_type` had no such member -> 22P02.
--
--   3. The form offers "Consultation" and "Deadline" as Event Types, and the
--      Filters drawer additionally filters on 'birthday' and 'renewal' (the
--      client-side synthesised events from `useClientBirthdays` /
--      `usePolicyRenewals`). `event_type` had none of the four. Because the
--      filter reaches the DB as `.in('event_type', ...)`, ticking "Birthday"
--      failed the whole calendar *read*, not just a create.
--
-- `event_status` gains 'rescheduled' for the same reason: `UpdateEventSchema`
-- accepts it and `updateEvent` forwards the validated payload to the DB
-- unchanged, so `PUT /calendar/events/:id` with that status hit 22P02 too.
--
-- Verified against production before this was written: probing INSERTs
-- returned exactly 42703 and 22P02 as described, and an INSERT restricted to
-- values the old schema accepted succeeded. All probes were rolled back.
--
-- Enum values are appended rather than placed with BEFORE/AFTER: sort order of
-- `event_type` is not semantic anywhere in the app, and appending keeps this
-- re-runnable without depending on the position of existing members.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS recurrence_rule text;

ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'consultation';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'deadline';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'birthday';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'renewal';

ALTER TYPE public.location_type ADD VALUE IF NOT EXISTS 'virtual';

ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'rescheduled';

-- Reminders carry the identical drift. Nothing in the UI creates a reminder
-- today, but `POST /calendar/reminders` is live and `CreateReminderSchema`
-- DEFAULTS priority to 'medium' — a value the enum did not have — so the very
-- first caller would have hit 22P02 on a payload it never even set.
--
-- 'compliance' is listed here even though production already has it: the
-- baseline migration's CREATE TYPE omits it, so a database rebuilt from this
-- folder would not. ADD VALUE IF NOT EXISTS is a no-op against production and
-- closes that gap for a fresh build. Per the README's rule 3 this is fixed
-- forward rather than by editing the historical baseline file.

ALTER TYPE public.reminder_priority ADD VALUE IF NOT EXISTS 'medium';
ALTER TYPE public.reminder_priority ADD VALUE IF NOT EXISTS 'urgent';

ALTER TYPE public.reminder_type ADD VALUE IF NOT EXISTS 'compliance';
ALTER TYPE public.reminder_type ADD VALUE IF NOT EXISTS 'task';
ALTER TYPE public.reminder_type ADD VALUE IF NOT EXISTS 'deadline';
ALTER TYPE public.reminder_type ADD VALUE IF NOT EXISTS 'call';
ALTER TYPE public.reminder_type ADD VALUE IF NOT EXISTS 'email';

ALTER TYPE public.reminder_status ADD VALUE IF NOT EXISTS 'dismissed';
