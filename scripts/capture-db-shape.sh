#!/usr/bin/env bash
# Capture the comparable shape of a database: one CSV line per table, holding
# exact row count, index count, constraint count and the row-security flag.
#
# Run identically against the Supabase source and against the scratch Postgres
# the weekly backup restores into (.github/workflows/weekly-backup.yml). The
# output is consumed by scripts/compare-restore.py, which is where the rules for
# what may and may not differ are written down.
#
#   usage: capture-db-shape.sh <connection-string> <output.csv>
#
# Exact count(*), never reltuples: an estimate cannot prove a restore is
# complete, and the estimates here are visibly wrong — the dashboard's
# estimate-based listing reports `events` and `reminders` as 0 rows when they
# hold 5 and 1.
#
# `auth` is included alongside `public` because the dump carries it and auth
# users are the one dataset whose loss would be least recoverable. If the
# connection cannot read that schema the rows simply do not appear, and the
# comparison adjusts on its own rather than failing.
set -euo pipefail

CONN="${1:?connection string required}"
OUT="${2:?output path required}"

psql "$CONN" -At -F',' -v ON_ERROR_STOP=1 -c "
  select n.nspname || '.' || c.relname,
         (xpath('/row/c/text()',
                query_to_xml(format('select count(*) as c from %I.%I',
                                    n.nspname, c.relname),
                             false, true, '')))[1]::text::bigint,
         (select count(*) from pg_index i where i.indrelid = c.oid),
         (select count(*) from pg_constraint k where k.conrelid = c.oid),
         c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname in ('public', 'auth')
    and c.relname not like 'pg_%'
  order by 1;
" > "$OUT"

test -s "$OUT" || { echo "::error::No tables captured from the database — refusing to continue."; exit 1; }
