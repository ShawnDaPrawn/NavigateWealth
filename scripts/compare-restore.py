#!/usr/bin/env python3
"""Compare a restored database against the source it was dumped from.

Used by .github/workflows/weekly-backup.yml as the gate on the weekly disaster-
recovery rehearsal. Reads three CSVs produced by identical SQL run against the
source before the dump, the source after the dump, and the restored scratch
database.

WHY ROW COUNTS ARE A RANGE AND NOT AN EQUALITY
----------------------------------------------
`pg_dump` reads from a consistent snapshot taken when it starts. A count taken
by a separate `psql` afterwards therefore describes a NEWER database, so any
write landing in between — and this database has cron jobs writing to it —
would fail the job on a backup that is perfectly good. Bracketing the dump
between two counts fixes that without the plumbing an exported snapshot needs:
the restored count must fall within the range the source held while the dump was
running. A table that did not change gives an exact equality anyway, and real
data loss still fails, because it lands outside the bracket.

WHY STRUCTURE IS AN EQUALITY
----------------------------
Indexes, constraints and the row-security flag do not change under normal
traffic, and a restore that loads every row while dropping them is not a usable
restore — it is a pile of data with no primary keys. Those are compared exactly.

Policies are deliberately NOT compared. RLS policies here call `auth.uid()`,
which does not exist in a vanilla Postgres, so they cannot restore into the
scratch database and their absence says nothing about the backup.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path


class Row:
    __slots__ = ("table", "rows", "indexes", "constraints", "rls")

    def __init__(self, table: str, rows: str, indexes: str, constraints: str, rls: str):
        self.table = table
        self.rows = int(rows)
        self.indexes = int(indexes)
        self.constraints = int(constraints)
        self.rls = rls.strip().lower() in ("t", "true", "1")


def load(path: Path) -> dict[str, Row]:
    out: dict[str, Row] = {}
    with path.open(newline="") as fh:
        for fields in csv.reader(fh):
            if not fields or not fields[0].strip():
                continue
            if len(fields) != 5:
                raise SystemExit(
                    f"{path}: expected 5 columns per line, got {len(fields)}: {fields!r}"
                )
            row = Row(*fields)
            out[row.table] = row
    if not out:
        raise SystemExit(f"{path}: no tables found — refusing to pass a vacuous comparison")
    return out


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: compare-restore.py BEFORE.csv AFTER.csv RESTORED.csv", file=sys.stderr)
        return 2

    before, after, restored = (load(Path(p)) for p in sys.argv[1:4])
    failures: list[str] = []

    missing = sorted(set(before) - set(restored))
    if missing:
        failures.append(f"tables absent from the restore: {', '.join(missing)}")

    extra = sorted(set(restored) - set(before) - set(after))
    if extra:
        failures.append(f"tables in the restore that the source never had: {', '.join(extra)}")

    for table in sorted(set(before) & set(restored)):
        b, a, r = before[table], after.get(table, before[table]), restored[table]

        low, high = min(b.rows, a.rows), max(b.rows, a.rows)
        if not (low <= r.rows <= high):
            window = f"{low}" if low == high else f"{low}..{high}"
            failures.append(
                f"{table}: restored {r.rows} rows, source held {window} across the dump"
            )

        if r.indexes != b.indexes:
            failures.append(f"{table}: {b.indexes} indexes at source, {r.indexes} restored")
        if r.constraints != b.constraints:
            failures.append(
                f"{table}: {b.constraints} constraints at source, {r.constraints} restored"
            )
        if r.rls != b.rls:
            failures.append(
                f"{table}: row security {'on' if b.rls else 'off'} at source, "
                f"{'on' if r.rls else 'off'} restored"
            )

    if failures:
        print("DR rehearsal FAILED:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1

    total = sum(r.rows for r in restored.values())
    print(
        f"DR rehearsal passed: {len(restored)} tables, {total} rows, "
        "every index, constraint and row-security flag intact."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
