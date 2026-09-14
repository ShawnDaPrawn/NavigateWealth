-- ============================================================================
-- APPLIED IN PRODUCTION 2026-09-13 as version 20260913181044.
--
-- Nightly maintenance for the two system tables that filled the disk IO
-- budget (Supabase warning, 2026-09-13).
--
-- WHAT WAS FOUND. Nothing had ever purged cron.job_run_details, which pg_cron
-- appends to on every run and never trims. Eleven jobs, two of them every 30
-- seconds, had written ~800,000 rows; each row carries the full job command
-- (~1.5 kB), so the table was 1.3 GB for a week's worth of useful history.
-- net._http_response is trimmed by pg_net's own 6-hour TTL delete, but its
-- dead space was only ever pruned in place, never vacuumed, so the file grew
-- to 609 MB for ~1,100 live rows and the TTL delete walked a bloated index
-- (527 pages for zero matching rows, measured) every few seconds.
--
-- Both tables are read in full by the weekly pg_dump backup and by every
-- ad-hoc health query in docs/runbooks/scheduled-jobs.md, so 1.9 GB of junk
-- was being re-read from disk on a Nano/Micro compute add-on whose baseline
-- disk throughput is a few tens of MB/s. count(*) on the pair took 97 s.
--
-- WHAT THIS DOES. Two pg_cron jobs, owned by postgres (which holds TRUNCATE,
-- DELETE and PG17 MAINTAIN on both tables; supabase_admin owns them):
--   1. Delete cron history older than 7 days -- the retention Supabase's own
--      docs recommend, and the window docs/runbooks/scheduled-jobs.md query A
--      reads. Rows still running (end_time IS NULL) are never touched.
--   2. VACUUM (ANALYZE) both tables so freed space goes back into the free
--      space map and pg_net's inserts reuse it instead of extending the file.
--      Plain VACUUM cannot run inside a transaction, which is why this is a
--      pg_cron job (each job runs as its own top-level statement) and not a
--      statement in this migration.
--
-- The one-off reclaim (TRUNCATE + reinsert of the last 7 days; TRUNCATE of the
-- 6-hour response table) was run by hand on 2026-09-13 before this migration
-- and is not repeated here: a migration must be safe to re-run.
-- ============================================================================

select cron.schedule(
  'db-maintenance-purge-cron-history',
  '0 2 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);

select cron.schedule(
  'db-maintenance-vacuum-system-tables',
  '20 2 * * *',
  $$vacuum (analyze) cron.job_run_details, net._http_response$$
);
