# Edge Function latency — where the seconds actually go

**Measured 2026-08-26 against project `vpjmdsltwrnpefzcgdmz` over the preceding
24 hours of real traffic.** Re-measure before trusting any number here; the
queries are at the bottom.

The app's users are in South Africa. Their median request to the Edge Function
took **2.8 seconds** before the region pin and takes **2.2 seconds** after it.
This document is about where those seconds go.

The answer, now that all three hypotheses have been tested: roughly **1,010 ms
is fixed Supabase platform overhead** that no code change touches, roughly
**670 ms was geography** and has been recovered by pinning execution to the
database's continent, and only **330–550 ms is this application's own work**.
Cold start, which looked like the most likely culprit, turned out to contribute
nothing.

> **CORRECTED 2026-10-11 — the ~1 s floor is NOT fixed platform overhead. It
> is the cost of starting a worker for THIS function, and almost every request
> starts one.** The conclusion above (and the "Resolved" section below) is
> wrong, and the correction changes what is worth doing next.
>
> **1. Nearly every request gets a new worker.** In the 24 hours to
> 2026-10-11, `function_logs` recorded 4,086 `Boot` events for 3,974 requests
> in `function_edge_logs`; 4,076 `execution_id`s carry exactly one boot, and
> only 71 requests landed on a worker that had served one before. Every
> shutdown reason was `EarlyDrop`. The "no variance, so not cold start"
> argument below fails for exactly this reason: when every request is cold,
> cold start has no variance.
>
> **2. A no-work request is fast on a reused worker.** The `OPTIONS` 204
> preflight — the request below that "provably does no work" — took
> **24–36 ms** on the few reused workers and **1,178–1,300 ms** on fresh ones.
>
> **3. The cost scales with the function, not the platform.** Controlled
> test, 2026-10-11 14:39 UTC: 8 concurrent `GET`s from `pg_net` inside the
> database to each of two functions in the same project, so caller, region
> (`us-east-2`) and time were identical, and each request got its own fresh
> worker:
>
> | target                                                        | min      | p50          | max      |
> | ------------------------------------------------------------- | -------- | ------------ | -------- |
> | `navigate-publications-artwork-pgnet` (one file; 405 at once) | 231 ms   | **244 ms**   | 259 ms   |
> | `make-server-91ed8379` `/health` (static JSON, no I/O)        | 1,292 ms | **1,432 ms** | 1,525 ms |
>
> Both import `supabase-js`; the small one boots in ~240 ms all in. About
> **1.2 s of every request to the main function is the price of its size** (a
> ~3.2 MB source payload plus PDF/DOCX/XLSX/crypto dependencies, all in one
> bundle). The runtime's own `boot_time` (~85 ms) does not include it.
>
> **What follows.** "No app-side change recovers it" is false. A lean
> function carrying only the hot admin reads should answer in ~250 ms plus its
> own work instead of ~1.4 s plus its own work — the largest single latency
> lever available, ahead of any query tuning. Fewer requests per screen also
> pays directly, since each one is a fresh worker. Re-run the test with the
> query under "Re-measuring" before relying on these numbers.

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

#### The pin took, and it is worth about 666 ms at p50

**Measured 2026-08-26, 24-hour window, ZA traffic split by serving region.**
Both sides are in the same window because the pin rolled out inside it, so this
is the same traffic pattern before and after — not two different days.

| ZA traffic served from | calls | min_ms | p50_ms | p95_ms |
| ---------------------- | ----- | ------ | ------ | ------ |
| `eu-west-3` (pre-pin)  | 78    | 1,113  | 2,820  | 4,963  |
| `us-east-1` (pinned)   | 100   | 1,525  | 2,154  | 3,506  |

- **p50: −666 ms. p95: −1,457 ms.** The pin works, and it helps the slow
  requests most, which is the right shape — those are the chatty routes making
  several database round trips each.
- **The prediction was too optimistic.** This note expected "roughly 1,200 ms of
  the ~1,376 ms". The realised p50 gain is 666 ms, about half of that. The
  1,376 ms figure came from a 4-call `eu-west-3` sample; the 78-call sample here
  is the more trustworthy number, and against it the theoretical maximum was
  never 1,376 ms to begin with.
- **`min_ms` went the other way: 1,113 → 1,525 ms.** The fastest ZA request got
  ~400 ms _slower_. That is the documented trade-off arriving exactly as
  described above — the client now pays one long leg to Virginia on every
  request, so a route that reads a single key has nothing to win and the extra
  client distance to lose. Only routes that make more than one database call come
  out ahead. Nothing to fix; worth knowing before anyone reads `min_ms` as a
  regression.

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
nothing.

That is all the preflight establishes. It narrows the search; it does not name
a culprit.

#### ~~Resolved: the floor is fixed platform invocation cost, not cold start~~ (wrong — see the 2026-10-11 correction at the top)

**Measured 2026-08-26, 24-hour window, grouped by method, status and serving
region.** The `204` preflight rows are the answer, because a preflight is the
only request in the system that provably does no work:

| Request                     | region      | calls | min_ms | p05_ms | p50_ms |
| --------------------------- | ----------- | ----- | ------ | ------ | ------ |
| `OPTIONS` → `204` preflight | `us-east-1` | 7     | 1,010  | 1,015  | 1,057  |
| `OPTIONS` → `204` preflight | `eu-west-3` | 26    | 1,113  | 1,129  | 1,344  |
| `POST` → `200` (cron)       | `us-east-2` | 4,339 | 1,091  | 1,318  | 1,637  |
| `GET` → `200`               | `us-east-2` | 52    | 1,126  | 1,258  | 1,424  |

Read the preflight row: **min 1,010, p05 1,015, p50 1,057.** A 47 ms spread from
the floor to the median, on requests that perform no I/O at all.

**That kills cold start.** A cold-start component would show up as variance —
some requests paying a bundle fetch and isolate boot, most not — and the
signature this note predicted was "a wide `min_ms`-to-`p95_ms` spread on bursty
ZA traffic against a narrow one on steady cron traffic". The opposite happened.
The preflights are nearly identical to each other, and the bursty ZA rows
(1,525 → 3,506) actually have a _narrower_ spread than the steady 4,403-call
cron rows (1,016 → 3,607). A cost that every request pays, in the same amount,
is not a cold start.

**It also is not the app.** 4,403 co-located `us-east-2` calls and not one beat
1,016 ms. Saturated traffic against a warm isolate in the database's own region
still hits the same floor as a preflight that runs no route code.

So of the three candidates, two are now excluded and the remaining one is the
answer: **~1,010 ms of fixed Supabase Edge Function invocation overhead —
request admission, scheduling and TLS setup — sitting inside `execution_time_ms`
before any of this application's code runs.** There is no app-side change that
recovers it. Escalating it to Supabase, or moving the hot routes off Edge
Functions, are the only levers.

**What that leaves for the app.** Size it within one region, so distance cancels
out. In `us-east-2`: a no-work request floors at ~1,016–1,091 ms, a real `GET`
runs a p50 of 1,424 ms, a real `POST` 1,637 ms. **The app's own work plus its
database round trips is therefore roughly 330–550 ms at p50** — and that is the
entire budget route-level optimisation can address. Everything else in a ZA
client's 2,154 ms p50 is the ~1,010 ms platform floor plus the client's own leg
to Virginia, neither of which a code change reaches.

**One earlier guess about that 330–550 ms, retracted.** An earlier draft named
sequential `kv.get` calls as the likely culprit. A scan of the server tree does
not support it: the batch and parallel primitives are already in wide use — 109
files call `mget` or `getByPrefix`, and there are 142 `Promise.all` sites across
72 files — and two passes of a serial-chain detector found no route awaiting
three or more keys in series that was not a false positive from function-boundary
bleed (the aggregation paths delegate their reads to resolvers that batch). It
remains possible on a route not yet read; it is no longer a claim.

#### A correction: cron traffic does NOT keep the pinned region warm

An earlier draft of this note argued that pinning to `us-east-1` would put
client traffic onto the same warm pool as the cron jobs. **That is wrong**, and
it contradicts the "What this does not say" section at the foot of this file.

The cron jobs are invoked by `pg_net` from inside the database, so they execute
in **`us-east-2`**, and `supabase/cron/publications-jobs.sql` sends no
`x-region` header. The pin targets **`us-east-1`**, because `us-east-2` is not a
value Supabase accepts on `x-region`. Different regions mean different isolate
pools: cron traffic cannot keep a pinned `us-east-1` instance warm.

If anything the risk runs the other way, and is worth watching. ZA client
traffic is bursty — 25/16/60/34 calls in one afternoon window, then zero for
twenty hours — and after the pin it lands in a region nothing else drives. If
cold start does turn out to be a real component of the floor, pinning could make
the first request of a burst _slower_ even while it makes the steady-state
faster. #240 is justified on geography, which is measured. It is not justified on
warmth, which was an assumption and a wrong one.

Caught by Codex review on #242.

**The risk it flagged did not materialise**, and the measurement above says why:
cold start is not a component of the floor at all, so landing in a region nothing
else drives costs the first request of a burst nothing. The reasoning was still
right — it just turned out not to matter here.

#### Per-request cost that was found and removed

Not the floor, but real, and it is gone: 113 admin route registrations chained
`requireAuth, requireAdmin`, and `requireAdmin` is a strict superset of
`requireAuth`. Every one of those requests made **two** Supabase Auth round trips
and **two** database reads to answer one question. Removed in the same series of
changes as this note, with a source-scanning ratchet
(`__tests__/auth-middleware-cost.test.ts`) so the pattern cannot come back. It
only ever affected admin routes, so it does not show up in the
`/publications/articles` numbers above.

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

**Did the pin take, and what is the floor per region?** Run it over a window
that actually contains South African traffic; a window of cron-only traffic
tells you nothing. Note that the cron rows will read `us-east-2` and the pinned
client rows `us-east-1` — that is expected, not a fault, and it is why cron
volume says nothing about how warm the client pool is.

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

Read it like this. All three questions were answered on 2026-08-26; re-run to
confirm the answers still hold, not to discover them.

- **Did the pin take?** ZA rows should show `fn_region = us-east-1` instead of
  `eu-west-3`. Binary, and it needs only a handful of calls. **Answered: yes.**
- **Is there a floor at all, and does it move?** `min_ms` is the number to watch,
  not `p50_ms`. **Answered: ~1,010–1,090 ms in every region, ZA and US alike, and
  the pin does not move it.** It is platform invocation cost, not geography.
- **Is cold start part of it?** A wide `min_ms`-to-`p95_ms` spread on bursty ZA
  traffic against a narrow one on steady cron traffic is the signature.
  **Answered: no** — the spread came out narrower on the bursty traffic than on
  the steady traffic, which is the opposite signature, and the preflight query
  below settles it outright.

**The decisive query — isolate requests that do no work.** An `OPTIONS`/`204`
preflight is short-circuited by `cors()` before any handler, KV read or auth
check, so whatever it costs is pure platform overhead. Group by method and
status so those rows separate out:

```sql
select
  log_attributes['request.method'] as method,
  log_attributes['response.status_code'] as status,
  log_attributes['response.headers.x_sb_edge_region'] as fn_region,
  count() as calls,
  round(min(toFloat64OrNull(log_attributes['execution_time_ms']))) as min_ms,
  round(quantile(0.05)(toFloat64OrNull(log_attributes['execution_time_ms']))) as p05_ms,
  round(quantile(0.5)(toFloat64OrNull(log_attributes['execution_time_ms']))) as p50_ms
from logs
where source = 'function_edge_logs'
  and log_attributes['execution_time_ms'] != ''
group by method, status, fn_region
having calls >= 5
order by calls desc
```

The `OPTIONS`/`204` row's `p05_ms` is the app's floor with the app removed. If it
is still ~1,010 ms, nothing has changed. If `p50_ms` on that row runs far above
its own `min_ms`, cold start has become real after all and the conclusion above
needs revisiting. The gap between that row's `p50_ms` and a real request's
`p50_ms` **in the same region** is the app's own work — the only part a code
change can reduce.

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

**Worker reuse and the size test (2026-10-11).** How many requests start a
worker, and what a no-work request costs on a fresh versus reused one:

```sql
-- requests vs boots (run each in the Logs Explorer, last 24 h)
select count(*) from logs where source = 'function_edge_logs';
select countIf(log_attributes['event_type'] = 'Boot') from logs where source = 'function_logs';

-- first request on a worker vs later ones
select if(rn = 1, 'fresh worker', 'reused worker') as kind, m, count(*) n,
       round(quantile(0.5)(ms), 0) as p50_ms, round(min(ms), 0) as min_ms
from (
  select toFloat64OrZero(log_attributes['execution_time_ms']) as ms,
         log_attributes['request.method'] as m,
         row_number() over (partition by log_attributes['execution_id'] order by timestamp) as rn
  from logs where source = 'function_edge_logs'
) group by kind, m order by kind, m;
```

The size test fires identical `GET`s from inside the database, so caller and
region are the same for both functions (`pg_net` is already installed for the
cron jobs; the small function answers a `GET` with 405 before doing anything):

```sql
select
  (select array_agg(net.http_get(url := 'https://<ref>.supabase.co/functions/v1/navigate-publications-artwork-pgnet?probe=small-' || g)) from generate_series(1, 8) g),
  (select array_agg(net.http_get(url := 'https://<ref>.supabase.co/functions/v1/make-server-91ed8379/health?probe=big-' || g)) from generate_series(1, 8) g);
```

then, a minute later, group `function_edge_logs` rows whose `request.search`
contains `probe=` by `function_id`.

## What this does not say

- It does not say the geographic penalty was recovered in full. Pinning moves the
  long haul from N database round trips to one client round trip; the win scales
  with how many queries a route makes, so a single-key route gains little and a
  chatty one gains most. Measured: −666 ms at p50, against a prediction of
  ~1,200 ms.
- It does not measure what the client actually experiences. Every number here
  is `execution_time_ms`, measured at the edge. The browser additionally pays
  its own round trip to the PoP, which none of these queries can see.
- It says nothing about the cron jobs. They are invoked by `pg_net` from inside
  the database, so they already execute in `us-east-2` and are unaffected
  either way.
