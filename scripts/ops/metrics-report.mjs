#!/usr/bin/env node
/**
 * Per-route-family metrics for make-server-91ed8379 (roadmap §7.5).
 *
 * WHY THERE IS NO INSTRUMENTATION IN THE REQUEST PATH
 * ---------------------------------------------------
 * The roadmap proposed emitting counters and latency from the shared
 * middleware, and choosing a sink (log drains vs. the in-house quality-issues
 * store vs. OTLP). That work is unnecessary: Supabase ALREADY records, per
 * request, everything the gate asks for —
 *
 *   request.pathname · request.method · response.status_code ·
 *   execution_time_ms · request_id
 *
 * in the `function_edge_logs` source. Adding a middleware would have bought
 * nothing except latency on every request and, if the sink had been KV, writes
 * to the very table whose write amplification was just fixed (1,085 B-trees per
 * write → 2). The correct implementation of "emit metrics" here is to stop and
 * query what is already emitted.
 *
 * WHAT THIS ANSWERS
 * -----------------
 * Error rate and p50/p95 latency per route family for a window up to 24h —
 * the §7.5 gate, verbatim.
 *
 * USAGE
 *   SUPABASE_ACCESS_TOKEN=... node scripts/ops/metrics-report.mjs [--hours 24] [--json]
 *
 * The token is a Supabase Management API PAT (Account → Access Tokens). It is
 * read from the environment and never logged, never written to a file, and
 * never sent anywhere but api.supabase.com. If you have no token, the same SQL
 * runs from the Supabase dashboard's Logs Explorer — see
 * docs/runbooks/edge-function-metrics.md.
 *
 * The SQL and the analysis are exported and unit-tested
 * (`src/utils/observability/__tests__/metricsReport.test.ts`) so this file
 * cannot silently rot into a query that returns nothing.
 */
import { pathToFileURL } from 'node:url';

export const PROJECT_REF = 'vpjmdsltwrnpefzcgdmz';

/**
 * Route family = the 5th path segment.
 *   /functions/v1/make-server-91ed8379/auth/login-validate
 *   1:''  2:'functions'  3:'v1'  4:'make-server-91ed8379'  5:'auth'
 * ClickHouse arrays are 1-indexed, which is the off-by-one this comment exists
 * to stop the next person rediscovering.
 */
export const METRICS_SQL = `
select
  splitByChar('/', log_attributes['request.pathname'])[5] as route_family,
  count(*) as requests,
  countIf(toInt32OrZero(log_attributes['response.status_code']) >= 500) as errors_5xx,
  countIf(toInt32OrZero(log_attributes['response.status_code']) = 401) as unauthorized,
  round(100.0 * countIf(toInt32OrZero(log_attributes['response.status_code']) >= 500) / count(*), 2) as error_rate_pct,
  round(quantile(0.50)(toFloat64OrZero(log_attributes['execution_time_ms'])), 0) as p50_ms,
  round(quantile(0.95)(toFloat64OrZero(log_attributes['execution_time_ms'])), 0) as p95_ms,
  round(max(toFloat64OrZero(log_attributes['execution_time_ms'])), 0) as max_ms
from logs
where source = 'function_edge_logs'
group by route_family
having requests > 0
order by requests desc
`.trim();

/**
 * Latency budgets. Deliberately generous, and deliberately NOT a CI gate: this
 * reports, it does not fail a build. Measured on 2026-08-25 the whole function
 * sat at p50 ~1.5–2.7s INCLUDING the static /health probe, which means the
 * dominant term is cold start, not handler work. Gating on that would just
 * block every PR until Stage E lands.
 */
export const BUDGETS = { p50Ms: 1000, p95Ms: 3000, errorRatePct: 1 };

/** @typedef {{route_family:string,requests:number,errors_5xx:number,unauthorized:number,error_rate_pct:number,p50_ms:number,p95_ms:number,max_ms:number}} Row */

/**
 * Classify rows against the budgets. Pure, so it is unit-testable without a
 * token or a network.
 * @param {Row[]} rows
 */
export function analyse(rows) {
  const breaches = [];
  for (const r of rows) {
    if (r.error_rate_pct > BUDGETS.errorRatePct) {
      breaches.push({ family: r.route_family, metric: 'error_rate_pct', value: r.error_rate_pct });
    }
    // p50 is checked as well as p95. An earlier version declared BUDGETS.p50Ms
    // and never read it, so `health` — 1,497ms p50 against a 1,000ms budget —
    // reported no breach at all, and the script silently contradicted the budget
    // its own runbook advertises.
    if (r.p50_ms > BUDGETS.p50Ms) {
      breaches.push({ family: r.route_family, metric: 'p50_ms', value: r.p50_ms });
    }
    if (r.p95_ms > BUDGETS.p95Ms) {
      breaches.push({ family: r.route_family, metric: 'p95_ms', value: r.p95_ms });
    }
  }
  const totalRequests = rows.reduce((n, r) => n + Number(r.requests || 0), 0);
  const totalErrors = rows.reduce((n, r) => n + Number(r.errors_5xx || 0), 0);
  return {
    totalRequests,
    totalErrors,
    overallErrorRatePct: totalRequests
      ? Number(((100 * totalErrors) / totalRequests).toFixed(2))
      : 0,
    breaches,
    // ZERO ROWS IS NOT A HEALTHY WINDOW. A successful API response with a
    // missing or empty `result` — a log-source rename, schema drift, an
    // ingestion outage, a query that stopped matching — renders as 0 requests,
    // 0 errors and 0 breaches, which reads exactly like a quiet, perfectly
    // healthy service. That is the specific way monitoring tooling fails, and
    // the reason this script exists, so it is surfaced rather than smoothed over.
    noData: rows.length === 0 || totalRequests === 0,
  };
}

/**
 * `/health` is a static handler — `c.json({...})` with no IO whatsoever. Its
 * latency is therefore a direct read of platform + boot overhead, with the
 * application contributing nothing. That makes it the single most useful number
 * in the report, so it is called out rather than left as one row among many.
 * @param {Row[]} rows
 */
export function coldStartFloor(rows) {
  const health = rows.find((r) => r.route_family === 'health');
  if (!health) return null;
  return { p50Ms: health.p50_ms, p95Ms: health.p95_ms, requests: health.requests };
}

/** @param {Row[]} rows */
export function formatTable(rows) {
  const head = ['family', 'reqs', '5xx', '401', 'err%', 'p50ms', 'p95ms', 'maxms'];
  const body = rows.map((r) => [
    r.route_family || '(root)',
    r.requests,
    r.errors_5xx,
    r.unauthorized,
    r.error_rate_pct,
    r.p50_ms,
    r.p95_ms,
    r.max_ms,
  ]);
  const widths = head.map((h, i) =>
    Math.max(String(h).length, ...body.map((row) => String(row[i]).length)),
  );
  const pad = (cells) =>
    cells
      .map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i])))
      .join('  ');
  return [pad(head), pad(widths.map((w) => '-'.repeat(w))), ...body.map(pad)].join('\n');
}

async function queryLogs(token, hours) {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600_000);
  const url =
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs.all` +
    `?sql=${encodeURIComponent(METRICS_SQL)}` +
    `&iso_timestamp_start=${encodeURIComponent(start.toISOString())}` +
    `&iso_timestamp_end=${encodeURIComponent(end.toISOString())}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Supabase logs API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const payload = await res.json();
  return payload.result ?? [];
}

async function main() {
  const args = process.argv.slice(2);
  const hours = Number(args[args.indexOf('--hours') + 1]) || 24;
  const asJson = args.includes('--json');
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  if (!token) {
    console.error(
      'SUPABASE_ACCESS_TOKEN is not set.\n' +
        'Create one at Supabase → Account → Access Tokens, or run the SQL by hand:\n' +
        'see docs/runbooks/edge-function-metrics.md',
    );
    process.exit(2);
  }

  const rows = await queryLogs(token, Math.min(hours, 24));
  const summary = analyse(rows);
  const cold = coldStartFloor(rows);

  if (asJson) {
    console.log(JSON.stringify({ rows, summary, coldStartFloor: cold }, null, 2));
    if (summary.noData) process.exitCode = 3;
    return;
  }

  if (summary.noData) {
    console.error(
      `\nNO DATA for the last ${Math.min(hours, 24)}h.\n\n` +
        'The query succeeded and returned nothing. That is NOT the same as a\n' +
        'healthy window, and it is reported as a failure on purpose. Check, in\n' +
        'order:\n' +
        '  1. the function genuinely served no requests in the window;\n' +
        '  2. `select distinct source from logs` still lists function_edge_logs;\n' +
        '  3. log_attributes still carry request.pathname and execution_time_ms.\n',
    );
    process.exitCode = 3;
    return;
  }

  console.log(`\nmake-server-91ed8379 — last ${Math.min(hours, 24)}h\n`);
  console.log(formatTable(rows));
  console.log(
    `\n${summary.totalRequests} requests, ${summary.totalErrors} 5xx ` +
      `(${summary.overallErrorRatePct}%)`,
  );
  if (cold) {
    console.log(
      `\ncold-start floor (static /health handler): p50 ${cold.p50Ms}ms, p95 ${cold.p95Ms}ms\n` +
        '  /health does no IO, so this is platform + boot overhead. Every other\n' +
        '  family pays it before doing any work of its own.',
    );
  }
  if (summary.breaches.length) {
    console.log(`\n${summary.breaches.length} budget breach(es):`);
    for (const b of summary.breaches) {
      console.log(`  ${b.family}: ${b.metric} = ${b.value}`);
    }
  }
  console.log('');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
