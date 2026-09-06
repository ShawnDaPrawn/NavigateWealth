-- Calendar: point client_id at the users the product actually has
-- ==================================================================
--
-- `events.client_id` and `reminders.client_id` referenced `public.clients`,
-- a table created outside migrations that nothing in the product writes to
-- (0 rows in production on 2026-09-05). The admin calendar picks clients from
-- `profile/all-users`, whose ids are Supabase Auth user ids, so every event
-- created with a client attached failed with:
--
--   insert or update on table "events" violates foreign key constraint
--   "events_client_id_fkey"
--
-- and the SPA showed "Failed to create event".
--
-- Both foreign keys now reference `auth.users`, matching the sibling
-- `created_by` / `assignee_id` keys on the same tables. ON DELETE SET NULL is
-- kept: deleting a client account must not delete the adviser's history.
--
-- APPLIED 2026-09-06 00:55 UTC, after the edge function deployed (run 239 on
-- d4b2cc7, green at 00:12). Verified after: both constraints report
-- `REFERENCES auth.users(id) ON DELETE SET NULL` and convalidated = true, and
-- an insert carrying a real auth user as `client_id` was accepted (proved in a
-- transaction that was then rolled back, so no test row was left behind).
--
-- The filename carries the version production recorded (`20260906005533`),
-- not the one this file was authored under. Applying through the dashboard or
-- `apply_migration` stamps a fresh timestamp, and this folder's README makes
-- filename == recorded version the rule that keeps it honest.
--
-- ORDERING (why the stamp is later than the PR): this had to be applied AFTER
-- the edge function that stops embedding `client:clients(*)` was deployed.
-- That embed is resolved by PostgREST through the old foreign key; dropping
-- the key first would have broken GET /calendar/events until the deploy
-- landed. The service now derives `client` from `attendees`.
--
-- Data impact: none. Both columns were null on every row (the old key made any
-- other value impossible), so the new constraint validates trivially.

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_client_id_fkey;

ALTER TABLE public.events
  ADD CONSTRAINT events_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.reminders
  DROP CONSTRAINT IF EXISTS reminders_client_id_fkey;

ALTER TABLE public.reminders
  ADD CONSTRAINT reminders_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- `public.clients` itself is left in place. It is empty, unused, and dropping
-- it is a separate decision from fixing the calendar.
