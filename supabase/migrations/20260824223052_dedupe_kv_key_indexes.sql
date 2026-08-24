-- ============================================================================
-- APPLIED IN PRODUCTION 2026-08-24 as version 20260824223052.
--
-- Migration 20260316213718 ended with an UNNAMED, non-idempotent
-- `CREATE INDEX ON kv_store_91ed8379 (key text_pattern_ops)`. Postgres
-- auto-names such an index `kv_store_91ed8379_key_idx` and auto-suffixes it on
-- every re-run: `_key_idx1`, `_key_idx2`, … It had been re-executed 1,084 times
-- against the application's PRIMARY DATASTORE.
--
-- Measured on production before this migration:
--   heap 8,288 kB · indexes 1,573 MB · index_count 1,085
-- Measured after:
--   heap 8,288 kB · indexes 2,456 kB · index_count 2
--
-- Total relation size 1,595 MB → 24 MB, and — the part that matters for
-- request latency — every INSERT/UPDATE/DELETE on the KV table now maintains
-- 2 B-trees instead of 1,085. Query planning also stopped considering a
-- thousand identical candidates on every KV statement.
--
-- One text_pattern_ops index IS wanted: getByPrefix issues LIKE 'prefix%',
-- which the primary key's default opclass cannot serve. Verified after the
-- change with EXPLAIN ANALYZE — the prefix scan is an Index Only Scan on
-- kv_store_91ed8379_key_prefix_idx, 0.24 ms. It now has a stable explicit
-- name, so a re-run can never collide into a new suffix again.
--
-- The duplicates were dropped in batches OUTSIDE this transaction, because a
-- single transaction dropping 1,083 indexes holds ACCESS EXCLUSIVE on the KV
-- table — i.e. blocks every read and write in the product — for its duration.
-- The body below is idempotent: a no-op against production (already
-- reconciled), and the one correct index on a fresh rebuild.
-- ============================================================================

CREATE INDEX IF NOT EXISTS kv_store_91ed8379_key_prefix_idx
  ON public.kv_store_91ed8379 USING btree (key text_pattern_ops);

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT ic.relname
    FROM pg_index i
    JOIN pg_class c  ON c.oid = i.indrelid
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'public'
      AND c.relname = 'kv_store_91ed8379'
      AND ic.relname ~ '^kv_store_91ed8379_key_idx[0-9]*$'
      AND NOT i.indisprimary
  LOOP
    EXECUTE format('DROP INDEX public.%I', r.relname);
  END LOOP;
END $$;
