-- ============================================================================
-- APPLIED IN PRODUCTION 2026-09-14 as version 20260914083818.
--
-- Partial index so the every-minute scheduled-publish job can ask Postgres for
-- the articles that are due instead of reading all of them.
--
-- WHY. `POST /publications/cron/process-scheduled` ran `kv.getByPrefix('article:')`
-- every minute and filtered in Deno. Measured 2026-09-14: 165 article rows,
-- 660 kB of JSONB, ~950 MB a day pulled out of Postgres, serialised to JSON by
-- PostgREST, parsed, and discarded -- with zero articles actually scheduled.
-- In pg_stat_statements the prefix-scan statement had burned 3,794 s of
-- database time, the largest remaining consumer after the pg_net cleanup fixed
-- in 20260913181044. Same family as that incident: work whose cost scales with
-- total data rather than with pending work.
--
-- WHAT. The handler now filters on `value->>'status'`, and this index makes
-- that filter an index scan rather than a sequential one. Verified after
-- applying: the plan is an Index Scan touching 2 shared buffers in 0.05 ms,
-- against a 660 kB read before.
--
-- WHY THE PREDICATE IS ONLY THE STATUS. The tempting `AND key LIKE 'article:%'`
-- would make the index UNUSABLE for this query. PostgREST emits the prefix
-- bound as `key >= 'article:' AND key < 'article:<U+FFFF>'`, and Postgres's
-- predicate-implication prover cannot show that range implies the LIKE, so it
-- would refuse the index. Keyed on `key` so the range bound and the ORDER BY
-- are both satisfied by the same scan.
--
-- COST. Indexes only rows whose status is literally 'scheduled' -- currently 0
-- of 14,265 KV rows -- so it is a few pages and adds nothing measurable to the
-- write path, which already maintains two full B-trees on this table.
-- ============================================================================

CREATE INDEX IF NOT EXISTS kv_store_91ed8379_scheduled_status_idx
  ON public.kv_store_91ed8379 (key)
  WHERE (value ->> 'status') = 'scheduled';
