-- ============================================================================
-- OPERATOR SCRIPT — de-duplicate kv_store_91ed8379 key indexes
--
-- THIS IS NOT A MIGRATION, AND THAT IS THE POINT. Do not move it into
-- supabase/migrations/ and do not run it with `supabase db push`.
--
-- WHY IT CANNOT BE A MIGRATION
-- ----------------------------
-- `db push` wraps a migration in a single transaction. Dropping ~1,083 indexes
-- inside one transaction holds ACCESS EXCLUSIVE on kv_store_91ed8379 for the
-- whole transaction — and that table is the application's primary datastore, so
-- every read and write in the product blocks until it commits. DROP INDEX
-- CONCURRENTLY takes a far weaker lock but cannot run inside a transaction
-- block at all. The two requirements are mutually exclusive, so bulk cleanup
-- runs as a deliberate operational procedure instead.
--
-- Migration 20260824223052 therefore drops at most ONE index (the single
-- unsuffixed legacy name a fresh rebuild creates) and leaves the bulk case here.
--
-- WHEN YOU NEED THIS
-- ------------------
-- Only on a database that re-ran 20260316213718 and accumulated auto-suffixed
-- duplicates (`kv_store_91ed8379_key_idx1`, `_idx2`, …) — e.g. a restored
-- backup or a staging clone taken before 2026-08-24. Production was reconciled
-- on 2026-08-24: 1,085 indexes → 2, indexes 1,573 MB → 2,456 kB.
--
-- Check first; if step 2 returns NULL there is nothing to do:
--
--   SELECT count(*) FROM pg_index i
--   JOIN pg_class c ON c.oid = i.indrelid
--   JOIN pg_class ic ON ic.oid = i.indexrelid
--   WHERE c.relname = 'kv_store_91ed8379'
--     AND ic.relname ~ '^kv_store_91ed8379_key_idx[0-9]+$';
--
-- HOW TO RUN
-- ----------
-- In psql (or the Supabase SQL editor), running each step SEPARATELY —
-- CONCURRENTLY cannot be batched into one transaction:
--   1. Step 1 once.
--   2. Step 2 to GENERATE the drop statements, then execute its output.
--   3. Step 3 to verify.
--
-- Safe to interrupt and resume: step 1 is idempotent and step 2 only ever
-- matches the auto-suffixed names.
--
-- Rollback: none needed. If step 1's index were lost, re-running step 1
-- recreates it in seconds at this table size.
-- ============================================================================

-- ── Step 1: create the canonical, stably-named replacement ──────────────────
-- Must complete BEFORE step 2, so there is never a window with no
-- text_pattern_ops index to serve `getByPrefix`'s LIKE 'prefix%' scans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS kv_store_91ed8379_key_prefix_idx
  ON public.kv_store_91ed8379 USING btree (key text_pattern_ops);


-- ── Step 2: generate the DROP statements, then run the output ───────────────
-- Matches ONLY auto-generated suffixed names. It cannot match the primary key,
-- and it cannot match step 1's index, which is named `_key_prefix_idx`.
SELECT string_agg(
         format('DROP INDEX CONCURRENTLY IF EXISTS public.%I;', ic.relname),
         E'\n' ORDER BY ic.relname
       ) AS run_this
FROM pg_index i
JOIN pg_class c  ON c.oid = i.indrelid
JOIN pg_class ic ON ic.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'kv_store_91ed8379'
  AND ic.relname ~ '^kv_store_91ed8379_key_idx[0-9]*$'
  AND NOT i.indisprimary;


-- ── Step 3: verify ──────────────────────────────────────────────────────────
-- Expected afterwards: index_count = 2 (primary key + the prefix index).
SELECT count(*) AS index_count,
       pg_size_pretty(pg_indexes_size('public.kv_store_91ed8379')) AS index_bytes,
       pg_size_pretty(pg_total_relation_size('public.kv_store_91ed8379')) AS total
FROM pg_index i
JOIN pg_class c ON c.oid = i.indrelid
WHERE c.relname = 'kv_store_91ed8379';
