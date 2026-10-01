# Client totals refresh — a direct policy write still updates the profile

**What this is.** A client's profile shows totals derived from their
policies: retirement fund value, life and disability cover, premiums,
contributions. They are stored at `user_profile:{clientId}:client_keys` and
written only by `recalculateClientTotals`. Every path in the app that writes
`policies:client:{clientId}` calls it: the policy editor, policy extraction,
and `publishSyncRun` (the Portfolio tab, the external-agent endpoint, the
portal worker). A write made **straight into the database** calls nothing. That
is how the update bot changes values through the Supabase connector. On
2026-10-01 it left a policy at a current value of 569,366.18 while the
profile still showed 551,894.41.

The owner's rule (ROADMAP §9a item 5) is that **an external agent's update
applies automatically, with no further action or approval**. This mechanism
makes the profile follow, whichever way the agent writes.

```text
  Agent (Supabase connector)           Postgres                                  Edge Function
┌───────────────────────────┐  UPDATE  ┌───────────────────────────────────────┐  pg_net  ┌──────────────────────────────────┐
│ writes policies:client:X  │────────►│ kv_store_91ed8379                      │─────────►│ POST /client-totals-refresh/     │
│ straight into the KV table│         │  trigger: no PostgREST claims → X stale │  wake-up │   process                        │
└───────────────────────────┘         │ client_totals_refresh (X: seq n)        │          │ recalculateClientTotals(X)       │
                                      └───────────────┬─────────────────────────┘          │ → user_profile:X:client_keys     │
                                                      │ pg_cron every 2 min: the same       └──────────────────────────────────┘
                                                      ▼ wake-up, only when a client is stale
```

Migration `client_totals_refresh` (in `supabase/migrations/`) creates the
database side.

## How a write is noticed

- **The trigger** `kv_policies_mark_totals_stale` runs on
  `kv_store_91ed8379` for `policies:client:*` rows only, after an insert or an
  update of `value`.
- **App writes are left alone.** They arrive through PostgREST, which sets
  `request.jwt.claims`, and the app recalculates after them itself. A write
  with no claims came from the connector, the SQL editor or a migration, and
  only those mark the client. If the test ever misread an app write, the cost
  would be one redundant recalculation, never a wrong total.
- **Marking** bumps the client's counter in `public.client_totals_refresh`
  (`dirty_seq`). The client is stale while `refreshed_seq < dirty_seq`.
- **One wake-up per burst.** The trigger wakes the worker only when nothing
  was stale before the write. A bulk update across many clients costs one
  wake-up, and the worker keeps going until nothing is stale.
- **It never blocks the write.** Any error inside the trigger is caught and
  reported as a warning. The policy is written either way, and the totals
  wait for the next write or a manual recalculation.

## How the worker catches up

`POST /client-totals-refresh/process` takes the cron token or an admin
session. It lists stale clients, oldest change first, runs
`recalculateClientTotals` for each, and reports the counter it read. If
another write landed meanwhile, the counter has moved on, so the client stays
stale and the same run takes it again. A run stops starting new clients after
40 seconds, and the next wake-up or the sweep takes the rest.

Typical delay from the bot's write to the profile is a few seconds. If the
wake-up is lost, the pg_cron job `client-totals-refresh-sweep` catches it
within 2 minutes. That job only calls out when a client is stale.

## Checking it

```sql
-- Is anyone stale right now? (empty = every profile is current)
select client_id, dirty_seq, refreshed_seq, dirty_at, refreshed_at
from public.client_totals_refresh
where refreshed_seq < dirty_seq;

-- When was a client last caught up?
select * from public.client_totals_refresh where client_id = '<clientId>';

-- Wake the worker by hand: returns the pg_net request id, or null when nothing is stale
select public.client_totals_refresh_kick();
```

An admin can also recalculate one client from the app through the existing
`POST /integrations/recalculate-totals`.

To switch the trigger off without a deploy (totals then go back to staying
stale after direct writes, exactly as before it existed):

```sql
alter table public.kv_store_91ed8379 disable trigger kv_policies_mark_totals_stale;
-- and back on:
alter table public.kv_store_91ed8379 enable trigger kv_policies_mark_totals_stale;
```

## What this does not do

It keeps the **totals** right. A direct write still goes around the rest of
`publishSyncRun`: a field an adviser has locked can be overwritten, and
nothing is added to the policy's `integrationSyncHistory`. Values written
through the portfolio-table endpoint get both. ROADMAP §9a item 7 records
giving a connector-only agent the same rails.

## Failure modes

| Symptom                                                        | Cause and fix                                                                                                                                                                                                                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A client stays stale for more than a few minutes               | The worker is not being reached. Check `client-totals-refresh-sweep` with query A in `scheduled-jobs.md`, that the Vault secret `navigatewealth_cron_auth_token` exists, and the response for the request id `kick()` returns (`net._http_response`). |
| `refreshed_seq` keeps catching up but `dirty_seq` keeps rising | Something is writing that client's policies directly over and over. Normal for a bot that updates often; each write is followed by a recalculation.                                                                                                   |
| Totals still wrong although the client is not stale            | The recalculation ran but read nothing to total: check the policy's `categoryId` and that its field carries the right `keyId` in the Product Structure. Totals are only as good as the schema mapping, the same as for an edit in the app.            |
| Postgres logs `kv_policies_mark_totals_stale: could not mark…` | The trigger could not record the write (the table missing, say). The write itself went through; recalculate the client by hand, then find out why the table was unreachable.                                                                          |
