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

| File                                            | Applied?             | Source of its SQL                   |
| ----------------------------------------------- | -------------------- | ----------------------------------- |
| `20260316213717_baseline_untracked_objects.sql` | pre-existing objects | **Reconstructed** from `pg_catalog` |
| `20260316213718_create_kv_table_91ed8379.sql`   | ✅ `20260316213718`  | Verbatim from `schema_migrations`   |
| `20260420000001_esign_core_tables.sql`          | ❌ **NOT APPLIED**   | Repo-authored, never run            |
| `20260522225558_fna_intake_sessions.sql`        | ✅ `20260522225558`  | Verbatim from `schema_migrations`   |
| `20260821210412_atomic_auth_rate_limit.sql`     | ✅ `20260821210412`  | Verbatim from `schema_migrations`   |
| `20260824222932_fna_intake_rls_draft_only.sql`  | ✅ `20260824222932`  | Applied by this reconciliation      |
| `20260824223052_dedupe_kv_key_indexes.sql`      | ✅ `20260824223052`  | Applied by this reconciliation      |

Five of the six applied files carry SQL **copied verbatim** from what production
actually executed, not inferred. Only the baseline is reconstructed, and it says
so in its own header.

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

---

## Open remediation — not done here

### `esign_core_tables` is unapplied, and that is currently correct

No `esign_*` table exists in production. The matching code
(`esign-postgres-repo.ts`) is gated behind `ESIGN_DUAL_WRITE`, which defaults to
`false` and no-ops every method, so nothing is broken today.

**It is a loaded trap.** Setting `ESIGN_DUAL_WRITE=true` before applying this
migration would make every shadow write fail against a non-existent table — and
`shadowWrite()` logs and swallows those failures, so it would look like it was
working. Apply the migration first, verify the tables, then flip the flag.

### Nine functions have a mutable `search_path`

Supabase's linter flags every function in the baseline file
(`0011_function_search_path_mutable`). Three of them —
`get_events_today`, `get_reminders_due_today`, `get_upcoming_reminders` — are
`SECURITY DEFINER` **and** callable by the `anon` role over `/rest/v1/rpc/`.
They filter on `auth.uid()` so an anonymous call returns no rows; the exposure
is the definer-rights + mutable-search_path pairing, not the data.

`20260821210412` shows the correct shape: `set search_path = public`, `REVOKE
EXECUTE` from `public, anon, authenticated`, `GRANT` to `service_role` only.

### Two `FOR ALL USING (true)` policies on `personal_client_applications`

Named "service role", but neither is restricted `TO` a role — both are granted
to `public`, so `USING (true)` is satisfied by any caller RLS applies to. The
service role bypasses RLS entirely and never needed them. They appear to make
the four client-scoped policies on that table redundant.

### Four `tasks` policies gate on "signed in", not on role

They read `auth.uid() IS NOT NULL` while being named "Admin users can …". Any
authenticated user — including a client — satisfies them over PostgREST.

### Leaked-password protection is disabled

Supabase Auth can check credentials against HaveIBeenPwned. Operator toggle.

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
