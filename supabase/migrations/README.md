# Migrations — repo vs. production

**Reconciled 2026-08-24 against project `vpjmdsltwrnpefzcgdmz`. The folder now
tells the truth.**

Before this reconciliation the repo held four migration files, production had
recorded three unrelated versions, and five tables existed that no migration
had ever created. A previous pass documented the drift but could not close it
without database credentials. This pass had read/write access and closed it.

---

## The rule

**Filename == the version recorded in `supabase_migrations.schema_migrations`.**

If those two ever disagree again, the folder is lying and every conclusion
drawn from it is unsafe. Check with:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

## Current state — every file, verified

| File                                                          | Applied?             | Source of its SQL                             |
| ------------------------------------------------------------- | -------------------- | --------------------------------------------- |
| `20260316213717_baseline_untracked_objects.sql`               | pre-existing objects | **Reconstructed** from `pg_catalog`           |
| `20260316213718_create_kv_table_91ed8379.sql`                 | ✅ `20260316213718`  | Verbatim from `schema_migrations`             |
| `20260420000001_esign_core_tables.sql`                        | ❌ **NOT APPLIED**   | Repo-authored, never run                      |
| `20260522225558_fna_intake_sessions.sql`                      | ✅ `20260522225558`  | Verbatim from `schema_migrations`             |
| `20260821210412_atomic_auth_rate_limit.sql`                   | ✅ `20260821210412`  | Verbatim from `schema_migrations`             |
| `20260824222932_fna_intake_rls_draft_only.sql`                | ✅ `20260824222932`  | Applied by this reconciliation                |
| `20260824223052_dedupe_kv_key_indexes.sql`                    | ✅ `20260824223052`  | Applied by this reconciliation                |
| `20260826073401_close_rls_bypasses_and_over_broad_grants.sql` | ✅ `20260826073401`  | Applied via `apply_migration`, verified after |

Of the seven files that correspond to something production has run, five carry
SQL **copied verbatim** from what production actually executed, not inferred.
The baseline is reconstructed from introspection and says so in its own header.
`20260826073401` is the one that was authored here and then applied, in that
order, with the result verified afterwards.

## What was wrong, and what was done

### 1. Two files were mis-stamped

`20260520000001_fna_intake_sessions.sql` and
`20260821000001_atomic_auth_rate_limit.sql` were never the applied versions —
production recorded `20260522225558` and `20260821210412`, presumably because
the SQL was run through the dashboard rather than `supabase db push`. Both files
were deleted and replaced by correctly-stamped ones containing the verbatim
applied SQL.

### 2. Five tables existed that no migration created

`clients`, `tasks`, `reminders`, `events` and `personal_client_applications` —
plus six enum types, eight triggers and eight functions — were created outside
migrations entirely. They are now captured in
`20260316213717_baseline_untracked_objects.sql`, idempotently, so the database
can actually be rebuilt. **That file is reconstructed from introspection**: it
is an accurate photograph of the schema, not the original history. It cannot
recover intent, original ordering, or any data backfills that ran alongside.

### 3. A live authorization gap had been sitting unapplied for ~2.5 months

`fna_intake_client_update_draft` permitted a client to UPDATE their own FNA
session while `status IN ('client_draft','submitted')`, with a WITH CHECK that
constrained only ownership — not status. A client could therefore mutate an FNA
the adviser had already begun reviewing, and move a `submitted` row to
`accepted`, self-accepting their own Financial Needs Analysis.

The SPA never touches this table directly (all access goes through the Edge
Function on the service role, which bypasses RLS), but PostgREST is publicly
reachable with any authenticated user's JWT, so the gap was genuinely
exploitable — just not through the product's own UI.

The fix (SECURITY-AUDIT H-12) had been committed to this repo since June and
never applied. **Applied 2026-08-24** and verified: USING and WITH CHECK now
both read `(auth.uid() = client_id) AND (status = 'client_draft')`.

### 4. 1,084 duplicate indexes on the primary datastore

`20260316213718` ends with `CREATE INDEX ON kv_store_91ed8379 (key
text_pattern_ops)` — unnamed and not idempotent, so Postgres auto-suffixed a new
identical index on every re-run. Measured before / after:

|                | before       | after        |
| -------------- | ------------ | ------------ |
| heap           | 8,288 kB     | 8,288 kB     |
| indexes        | **1,573 MB** | **2,456 kB** |
| total relation | 1,595 MB     | 24 MB        |
| index count    | 1,085        | 2            |

Every KV write had been maintaining 1,085 B-trees. Fixed and recorded in
`20260824223052`, with the surviving index given a stable explicit name so a
re-run can never collide into a suffix again.

That migration drops **at most one** index — the unsuffixed legacy name a fresh
rebuild creates. Bulk cleanup of an already-degraded database (a restored backup,
a staging clone taken before 2026-08-24) is an operational procedure, not a
migration: `db push` runs migrations in a transaction, so a bulk drop there would
hold `ACCESS EXCLUSIVE` on the KV table for its whole duration and cause exactly
the outage it is meant to avoid. Use `scripts/ops/dedupe-kv-key-indexes.sql`.

---

## Remediation log

Struck-through entries are closed, with what was actually verified. Everything
not struck through is still open.

### `esign_core_tables` is unapplied, and that is currently correct

No `esign_*` table exists in production. The matching code
(`esign-postgres-repo.ts`) is gated behind `ESIGN_DUAL_WRITE`, which defaults to
`false` and no-ops every method, so nothing is broken today.

**It is a loaded trap.** Setting `ESIGN_DUAL_WRITE=true` before applying this
migration would make every shadow write fail against a non-existent table — and
`shadowWrite()` logs and swallows those failures, so it would look like it was
working. Apply the migration first, verify the tables, then flip the flag.

### ~~Nine functions have a mutable `search_path`~~ — CLOSED 2026-08-25

Fixed in `20260825004011` (pinned `SET search_path = public` on all nine) and
`20260825004035` (revoked the PUBLIC EXECUTE grant on the four definer helpers).

**Security advisors went from 17 findings to 2**, verified against production.

Worth reading for the mistake in the middle: the first migration revoked EXECUTE
from `anon` and `authenticated` and changed nothing. Postgres grants EXECUTE to
PUBLIC by default and both roles inherit it, so the ACL still read `=X/postgres`
and the advisors still flagged all three functions. **Revoking from named roles
while leaving the PUBLIC grant in place is a no-op that looks exactly like a
fix** — it only surfaced because the advisors were re-run afterwards rather than
the change being assumed to have worked.

The two remaining findings are `rls_enabled_no_policy` on `kv_store_91ed8379`
(INFO, and correct by design — RLS on with no policies denies everyone except
the service role, which is the only thing that touches it) and
leaked-password protection, an operator toggle.

### ~~Two `FOR ALL USING (true)` policies on `personal_client_applications`~~ — CLOSED 2026-08-26

Both dropped in `20260826073401`. They were not restricted `TO` a role, so they
applied to `public`; PERMISSIVE policies are OR'd, so the two of them subsumed
the four client-scoped policies beside them and `anon` and `authenticated` could
SELECT, INSERT, UPDATE and DELETE every row over PostgREST. The service role
bypasses RLS and never needed either one.

The table holds 0 rows, so nothing was exposed. It is also the destination for
the 192 `application:` records still in KV, which is why this was fixed before
any of that data moved rather than after.

### ~~Four `tasks` policies gate on "signed in", not on role~~ — CLOSED 2026-08-26

Replaced in `20260826073401` with the creator/assignee shape the sibling
`reminders` table already uses — `tasks` has both `created_by` and
`assignee_id`, so this is the existing pattern rather than a new one. The names
now describe what the policies do.

Writing a genuine _admin_ policy was considered and rejected: roles are resolved
from trusted auth sources in application code (`resolveTrustedRole`), so an
SQL-side admin test would be a second, divergent copy of the authorization
policy — the exact failure `client-access.ts` documents as the cause of S12 and
S14.

### ~~Over-broad table grants, TRUNCATE included~~ — CLOSED 2026-08-26

Seven tables granted the full privilege set to `anon` and `authenticated` from
the project-wide `ALTER DEFAULT PRIVILEGES`. **TRUNCATE is the one table
privilege RLS does not gate** — a perfect policy set does not stop it.

Not reachable: both roles are NOLOGIN, entered only via PostgREST, which has no
TRUNCATE verb. Removed in `20260826073401` as least privilege, and because the
lesson from `20260825004035` on this same project is that a half-revoked grant
looks exactly like a fixed one.

`kv_store_91ed8379` had ALL revoked rather than a subset — it carries zero
policies by design, so no grant to either role had a legitimate use. Verified
after: `anon` and `authenticated` now get `42501 permission denied` where they
previously got a successful SELECT returning 0 rows, and the service role still
reads all 9,498 rows.

One half of this is NOT closed, and pretending otherwise would repeat the
mistake above: a second default-ACL entry owned by `supabase_admin` still grants
the same set, and that role is platform-managed. A table created by
`supabase_admin` will still arrive with TRUNCATE granted to `anon`. Check any
new table with:

```sql
select grantee, privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name='<new table>'
  and grantee in ('anon','authenticated');
```

### Leaked-password protection is disabled

Supabase Auth can check credentials against HaveIBeenPwned. **Operator toggle**
— Authentication → Providers → Email → "Prevent use of leaked passwords". One
click, and it is the last open security-advisor finding on the project.

---

## Working rules

1. **Never write `CREATE INDEX` without a name and `IF NOT EXISTS`.** That one
   omission cost 1.5 GB and a thousandfold write amplification. The same applies
   to any object Postgres will auto-name.
2. **Apply through `supabase db push` or `apply_migration`, never the dashboard
   SQL editor.** Both of this folder's mis-stamped files came from running SQL
   somewhere that did not record a matching version.
3. **A migration file asserts what production ran.** When a file records a
   defect, fix it in a _new forward migration_ — do not edit the historical file
   into something that never executed.
4. **Re-verify before trusting this document.** It was accurate on 2026-08-24.
   Run the query at the top before relying on it.
