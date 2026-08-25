# Edge Function metrics — error rate and latency per route family

Answers roadmap §7.5: _"can a dashboard (even a script) answer error-rate and
latency per route family for the last 24h?"_ Yes — `npm run metrics`.

## The short version

```bash
SUPABASE_ACCESS_TOKEN=... npm run metrics            # last 24h, table
SUPABASE_ACCESS_TOKEN=... npm run metrics -- --json  # machine-readable
SUPABASE_ACCESS_TOKEN=... npm run metrics -- --hours 6
```

The token is a Supabase **Management API** personal access token
(Supabase → Account → Access Tokens). It is read from the environment, never
logged, never written to disk, and sent only to `api.supabase.com`.

No token? The same SQL runs in the dashboard: **Logs → Logs Explorer**, paste
the query from `scripts/metrics-report.mjs` (`METRICS_SQL`).

## Why there is no instrumentation in the request path

The roadmap proposed emitting counters and latency from the shared middleware
and choosing a sink. **That work was not done, on purpose.** Supabase already
records, for every request to the function:

| field                  | what it gives us              |
| ---------------------- | ----------------------------- |
| `request.pathname`     | route family                  |
| `request.method`       | verb                          |
| `response.status_code` | error rate                    |
| `execution_time_ms`    | p50 / p95 / max               |
| `request_id`           | correlation with our own logs |

…in the `function_edge_logs` source. Building a middleware would have added
latency to every request and, had the sink been KV, writes to the very table
whose write amplification was just repaired (1,085 B-trees per write → 2). The
correct implementation of "emit metrics" here was to query what is already
emitted.

Two traps, both hit while writing this and both now pinned by tests:

- **`edge_logs` is not `function_edge_logs`.** The former is the API gateway and
  carries no `execution_time_ms` for the function. Querying it returns a
  plausible table with no latency in it.
- **ClickHouse arrays are 1-indexed.** The route family is segment **5** of
  `/functions/v1/make-server-91ed8379/<family>/…`. An earlier draft used `[3]`
  and reported one family called `v1` for the entire function.

## Baseline, measured 2026-08-25

| family         |   reqs |   5xx |    p50 ms |    p95 ms |    max ms |
| -------------- | -----: | ----: | --------: | --------: | --------: |
| publications   |  5,188 |     1 |     1,918 |     3,998 |    29,163 |
| quality-issues |    146 |     0 |     2,661 |     7,188 |    31,171 |
| admin          |     94 |     0 |     4,424 |     6,584 |    11,460 |
| tasks          |     94 |     0 |     1,846 |     3,228 |    10,927 |
| integrations   |     71 |     0 |     1,732 |     4,892 |     8,724 |
| profile        |     53 |     0 |     1,806 |     3,736 |     6,195 |
| **health**     | **20** | **0** | **1,497** | **2,363** | **2,549** |
| kv-store       |     20 |     0 |     1,518 |     2,389 |     2,400 |

**Error rate is excellent: 1 5xx in 6,049 requests (0.02%).**

**Latency is not.** Read the `health` row first. `GET /health` is
`c.json({ status: 'healthy', … })` — a literal, no IO, no KV, no database. It
takes **1,497 ms at p50**. That number is not the handler; it is platform plus
boot overhead, and _every other family pays it before doing any work of its own_.
The spread between `health` (1,497 ms) and a real data route like `publications`
(1,918 ms) is only ~400 ms, which says the application's own work is a minority
of the time a client waits.

So the highest-value latency work is **not** query optimisation — the
application's own work is a minority of the wait.

**What this does NOT establish.** `execution_time_ms` is per-request and does
not flag a cold isolate, and the `health` sample is n=20. So "the cost is
outside application query work" is supported; "the cost is cold start" is a
hypothesis, and the most likely one, but not measured. Test it before spending
Stage E effort on it: hit `/health` twice in quick succession and compare the
first request against the second, or drive a burst and look at the distribution
rather than the median. The candidates, in order of likelihood:

1. **Boot payload.** The entry point loads `hono`, `cors`, the request-context
   shim and three mount registrars before serving anything. The 77 route modules
   are already lazy (that is why a data route costs only ~400 ms more than
   health) — the remaining cost is the boot graph itself.
2. **Isolate eviction.** A p50 this close to the p95 on a low-traffic function
   means a large share of requests land on a cold isolate. Traffic shape, not
   code, decides this one.
3. **Stage E (§7.4)** — carving out the heavy `esign` PDF/crypto paths and
   converting them to dynamic imports at their routes — targets (1) directly.
   **Confirm the hypothesis first**, then measure with this script before and
   after; the `health` row is the honest before/after number because it is the
   only one with no application work in it.

The 29–37 s `max_ms` values on `publications`, `quality-issues` and `clients`
are worth a separate look: something in those families occasionally takes half a
minute.

## Budgets

`BUDGETS` in the script is p50 1,000 ms / p95 3,000 ms / error rate 1%. All
three are evaluated — an early version declared `p50Ms` and never read it, so
`health` (1,497 ms p50, comfortably inside the p95 budget) reported no breach
and the script quietly contradicted the budget documented here.

**A window with no data exits 3 and says so.** A successful API response with an
empty result — a log-source rename, schema drift, an ingestion outage — would
otherwise render as 0 requests / 0 errors / 0 breaches, which is
indistinguishable from a quiet, healthy service. That silent zero is the
specific way monitoring tooling fails, so it is reported as a failure.

Deliberately **not** a CI gate. The whole function currently breaches the
latency budgets because of the cold-start floor above, so gating would block
every PR until Stage E lands, and a gate everyone disables is worse than no
gate. Revisit once the `health` p50 is under ~300 ms.
