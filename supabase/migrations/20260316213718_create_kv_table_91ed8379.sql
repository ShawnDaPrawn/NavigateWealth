-- ============================================================================
-- APPLIED IN PRODUCTION as version 20260316213718 (name: create_kv_table_91ed8379)
--
-- RECONSTRUCTED? NO. The body below is the statement recorded in
-- `supabase_migrations.schema_migrations.statements`, copied verbatim on
-- 2026-08-24. This is what production actually ran, not an inference from
-- introspection.
--
-- ---------------------------------------------------------------------------
-- ⚠️  THIS FILE CONTAINS A KNOWN DEFECT. IT IS RECORDED, NOT FIXED.
--
-- The third statement is `CREATE INDEX ON ...` — no name, no IF NOT EXISTS.
-- Postgres therefore auto-generates the name `kv_store_91ed8379_key_idx` and,
-- on every re-execution, auto-suffixes it: `_key_idx1`, `_key_idx2`, …
--
-- It has been re-executed 1,084 times. Measured on production 2026-08-24:
--
--     heap (actual data)   8,288 kB
--     indexes              1,573 MB      ← 1,085 btrees on one column
--     of which duplicates  1,546 MB
--
-- Every write to this table — the application's primary datastore — maintains
-- 1,085 identical B-trees. The fix is NOT applied here: this file must keep
-- asserting what production ran, or the repo starts lying again in a new way.
-- The remedy is a separate forward migration; see README.md §"Open remediation".
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kv_store_91ed8379 (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);

ALTER TABLE kv_store_91ed8379 ENABLE ROW LEVEL SECURITY;

-- ⚠️ Unnamed and not idempotent — see the banner above. Recorded as applied.
CREATE INDEX ON kv_store_91ed8379 (key text_pattern_ops);
