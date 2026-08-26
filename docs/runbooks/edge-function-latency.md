# Edge Function latency — where the seconds actually go

**Measured 2026-08-26 against project `vpjmdsltwrnpefzcgdmz` over the preceding
24 hours of real traffic.** Re-measure before trusting any number here; the
queries are at the bottom.

The app's users are in South Africa. Their median request to the Edge Function
takes **2.9 seconds**. This document is about where those seconds go, because
the answer turned out to be almost entirely geometry, and only partly code.

---

## The geometry

| Hop                        | Where                   |
| -------------------------- | ----------------------- |
| Client                     | Johannesburg            |
| Cloudflare PoP             | `JNB`                   |
| **Edge Function executes** | **`eu-west-3` (Paris)** |
| **Postgres**               | **`us-east-2` (Ohio)**  |

Supabase runs an Edge Function in the region closest to the _caller_, but the
database lives in exactly one region. So a South African request executes in
Paris and then makes every one of its database round trips across the Atlantic
— roughly 90 ms each, sequentially.

## The controlled measurement

One route, `/publications/articles`, split by the region that served it. Same
code, same database, same query:

| Edge region | Relative to the DB | calls | p50          | fastest  |
| ----------- | ------------------ | ----- | ------------ | -------- |
| `us-east-2` | **same region**    | 43    | **1,484 ms** | 1,016 ms |
| `us-east-1` | ~600 km            | 93    | 1,657 ms     | 959 ms   |
| `us-west-1` | continental        | 30    | 2,148 ms     | 1,112 ms |
| `eu-west-3` | transatlantic      | 4     | **2,860 ms** | 2,002 ms |
| `us-west-2` | continental        | 4     | 3,177 ms     | 2,343 ms |

p50 rises monotonically with distance from the database. Nothing else differs.

Aggregated across all routes the same split holds: `JNB`/`ZA` traffic served
from `eu-west-3` sits at p50 **2,873 ms** over 290 calls, while `CMH`/`US`
traffic served from `us-east-2` sits at **1,640 ms** over 4,277.

Sample-size honesty: the two slowest rows have only 4 calls each. The trend is
carried by the three rows with 30–93 calls plus the 290-call aggregate, not by
those two.

## So there are two separate problems, not one

### 1. Geography — about 1,376 ms for a South African client

`2,860 − 1,484`. Fixable by pinning execution to the database's region with the
`x-region` header, so the function↔database hops stop crossing an ocean. The
client pays one longer trip instead of N shorter ones, and N is greater than 1
on every route that reads more than a single key.

Status: **both halves are now in.** `create-app.ts` allows the `x-region`
header (shipped and deployed in #237), and the SPA sends it from a single fetch
interceptor (`src/utils/api/functionRegion.ts`). The two were split across
separate merges on purpose — the SPA and the function deploy through different
pipelines, so a client that sent the header before the function allowed it
would have failed every CORS preflight in between.

**The pin target is `us-east-1`, not the database's `us-east-2`.** Supabase's
supported `x-region` values for North America are `ca-central-1`, `us-east-1`,
`us-west-1` and `us-west-2` — `us-east-2` is not among them, even though the
database lives there. `us-east-1` is the nearest region it accepts, measured
above at p50 1,657 ms against `us-east-2`'s 1,484 ms. So the expected recovery
is roughly **1,200 ms of the ~1,376 ms**, not the whole of it. The module
validates any configured region against the supported list and falls back
loudly rather than putting an unaccepted value on the header.

The trade-off, from Supabase's own documentation: _"When you explicitly specify
a region via the `x-region` header, requests will NOT be automatically
re-routed to another region."_ Pinning buys latency and gives up automatic
failover. During a regional outage the pin has to be changed or removed.

**How to drop the pin during an outage.** Set `VITE_NW_FUNCTION_REGION` to
`auto`, or clear it to an empty value, in Vercel and redeploy the SPA. Either
stops the header being sent and returns to nearest-caller routing.

**Deleting the variable is not the off switch.** An absent variable means "not
configured", which pins to the default — that is what makes the feature work on
a fresh deploy with no configuration. Clear it, do not remove it. An earlier
draft treated empty and absent alike, which made this whole procedure a no-op;
caught in review on #240.

### 2. The app's own floor — about 1,000 ms, and geography does not explain it

Even co-located with the database, `/publications/articles` has a p50 of
1,484 ms and never once beat 1,016 ms. A `204` CORS preflight — which does no
work at all — took 1,016 ms. Boot is not the cause: the runtime reports
`booted (time: 57ms)` … `booted (time: 111ms)`, so the lazy-mount work already
did its job.

#### The preflight rules out per-request app code

The `204` preflight is the measurement that matters, and re-reading it changes
the diagnosis.

An `OPTIONS` preflight never reaches a route handler. `createApp()` registers
Hono's `cors()` middleware **first**, and for a preflight that middleware
returns a `204` without calling `next()` — so the request-id middleware, the
error handler, the lazy mounts and every route body are all skipped. On a warm
isolate that path performs no I/O whatsoever. It cannot take 1,016 ms.

So the floor is not per-request app cost, and the earlier guess above (sequential
`kv.get` calls where a batch would do) cannot explain a request that reads
nothing. What is left is **cold start**: bundle fetch, isolate creation and
top-level module evaluation, none of which the `booted (time: 57ms)` line
covers — that number is the isolate's own boot, measured after the payload has
already been fetched and compiled.

#### Which makes region pinning more valuable than #240 claimed

If the floor is cold start, then what drives it is how often a request finds a
cold isolate, and that is a function of **which regional pool the traffic lands
in**:

- Cron traffic runs `pg_net` from inside the database (Ohio), steady at roughly
  180–240 requests/hour. That is frequent enough to keep its region's isolates
  warm continuously.
- South African client traffic was landing in `eu-west-3` and is **bursty** —
  measured at 25/16/60/34 calls in one afternoon window and then zero for
  twenty hours. Nothing else keeps `eu-west-3` warm, so a burst after a gap
  pays a cold start on its first requests.

Pinning function execution to `us-east-1` (#240) was justified on geography
alone — the database is in `us-east-2` and the function was running in Paris.
But it should also put client traffic onto the same regional pool the cron
traffic keeps warm, which would remove cold starts rather than merely shortening
the round trip. That is a **hypothesis, not a measurement**: it needs the
`fn_region` × `colo` query below, run over a window that actually contains ZA
traffic.

#### What has been ruled out, and what has not

Ruled out: per-request handler work as the explanation for the floor (the
preflight does none and still hit it).

**Not** ruled out, and still worth measuring once there is traffic:

- Cold-start cost itself — the boot payload is already lazy-mounted, but the
  bundle is large and `x.ts`-style dynamic imports still have to be resolved.
- Sequential `kv.get` calls on the heavier routes. This no longer explains the
  floor, but it is still real per-request cost on top of it: `kv_store_91ed8379`
  has `mget` and `getByPrefix`, and a route that awaits five keys in series pays
  five round trips.
- One thing already fixed: 113 admin route registrations chained
  `requireAuth, requireAdmin`, and `requireAdmin` is a strict superset — so each
  of those requests made **two** Supabase Auth round trips and **two** database
  reads for one answer. Removed in the same series of changes as this note, with
  a source-scanning ratchet (`__tests__/auth-middleware-cost.test.ts`). That was
  per-request cost, not floor, and it only affected admin routes.

---

## Re-measuring

Both queries run against the unified logs stream (24-hour maximum window).

**Per-route, split by serving region** — the controlled comparison:

```sql
select
  log_attributes['request.pathname'] as path,
  log_attributes['response.headers.x_sb_edge_region'] as sb_region,
  count() as calls,
  round(quantile(0.5)(toFloat64OrNull(log_attributes['execution_time_ms']))) as p50_ms,
  round(min(toFloat64OrNull(log_attributes['execution_time_ms']))) as min_ms
from logs
where source = 'function_edge_logs'
  and log_attributes['execution_time_ms'] != ''
group by path, sb_region
having calls >= 4
order by path, sb_region
```

**Is client traffic sharing the cron traffic's warm pool?** — the query the
cold-start hypothesis above needs. Run it over a window that actually contains
South African traffic; a window of cron-only traffic tells you nothing.

```sql
select
  log_attributes['response.headers.x_sb_edge_region'] as fn_region,
  log_attributes['request.cf.colo'] as colo,
  log_attributes['request.cf.country'] as country,
  count() as calls,
  round(quantile(0.5)(toFloat64OrNull(log_attributes['execution_time_ms']))) as p50_ms,
  round(quantile(0.95)(toFloat64OrNull(log_attributes['execution_time_ms']))) as p95_ms,
  round(min(toFloat64OrNull(log_attributes['execution_time_ms']))) as min_ms
from logs
where source = 'function_edge_logs'
  and log_attributes['execution_time_ms'] != ''
group by fn_region, colo, country
order by calls desc
```

Read it like this: if `fn_region` is now `us-east-1` for both the ZA rows and
the Ohio cron rows, the pools are shared. If the ZA `min_ms` drops close to the
cron `min_ms` while the ZA `p95_ms` stays high, cold starts are still happening
but less often. If ZA `min_ms` stays near 1,000 ms, the floor is not cold start
and this note is wrong.

**Where the callers are, and which region serves them:**

```sql
select
  log_attributes['request.cf.colo'] as cf_colo,
  log_attributes['request.cf.country'] as country,
  log_attributes['response.headers.x_sb_edge_region'] as sb_region,
  count() as calls,
  round(quantile(0.5)(toFloat64OrNull(log_attributes['execution_time_ms']))) as p50_ms
from logs
where source = 'function_edge_logs'
  and log_attributes['execution_time_ms'] != ''
group by cf_colo, country, sb_region
order by calls desc
```

**Boot cost, to rule out cold starts before blaming them:**

```sql
select timestamp, event_message
from logs
where source = 'function_logs' and event_message like 'booted%'
order by timestamp desc
```

The database's own region comes from the project record, not from a guess:
`get_project` reports `"region": "us-east-2"`.

---

## What this does not say

- It does not say the 1,376 ms will be recovered in full. Pinning moves the
  long haul from N database round trips to one client round trip; the win
  scales with how many queries a route makes, so a single-key route gains
  little and a chatty one gains most.
- It does not measure what the client actually experiences. Every number here
  is `execution_time_ms`, measured at the edge. The browser additionally pays
  its own round trip to the PoP, which none of these queries can see.
- It says nothing about the cron jobs. They are invoked by `pg_net` from inside
  the database, so they already execute in `us-east-2` and are unaffected
  either way.
