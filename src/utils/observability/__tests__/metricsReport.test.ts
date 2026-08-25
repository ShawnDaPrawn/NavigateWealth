/**
 * Contract for the per-route-family metrics report (roadmap §7.5).
 *
 * The runner is a Node .mjs so it can be invoked without `npm ci`; Vite's React
 * plugin cannot transform it, so this suite drives it through a Node subprocess,
 * the same way postDeploySmoke.test.ts does.
 *
 * What is worth testing here is not the HTTP call — it is the SQL and the
 * analysis. A metrics script that silently returns zero rows reads exactly like
 * a healthy system, which is the specific way this kind of tooling fails.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const scriptHref = pathToFileURL(resolve(repoRoot, 'scripts/metrics-report.mjs')).href;

function call(expression: string): unknown {
  const source = `
    import * as m from ${JSON.stringify(scriptHref)};
    const result = await (${expression});
    process.stdout.write(JSON.stringify(result ?? null));
  `;
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    cwd: repoRoot,
    timeout: 15_000,
  });
  return JSON.parse(stdout) as unknown;
}

const SQL = call('m.METRICS_SQL') as string;

describe('metrics SQL answers the §7.5 gate', () => {
  it('reads the log source Supabase actually populates', () => {
    // Verified against production 2026-08-25: function_edge_logs carried 6,049
    // rows. `edge_logs` is a DIFFERENT source (the API gateway) and does not
    // carry execution_time_ms for the function — querying it would return a
    // plausible-looking table with no latency in it.
    expect(SQL).toContain("source = 'function_edge_logs'");
  });

  it('selects every field the gate asks for', () => {
    for (const field of ['error_rate_pct', 'p50_ms', 'p95_ms', 'requests', 'errors_5xx']) {
      expect(SQL, `missing ${field}`).toContain(field);
    }
    expect(SQL).toContain('execution_time_ms');
    expect(SQL).toContain('response.status_code');
  });

  it('takes the route family from the 5th path segment', () => {
    // /functions/v1/make-server-91ed8379/auth/login-validate
    //  1:''  2:'functions'  3:'v1'  4:'make-server-…'  5:'auth'
    // ClickHouse arrays are 1-indexed. An earlier draft used [3] and reported a
    // single family called "v1" for the entire function — a report that looks
    // fine and says nothing.
    expect(SQL).toContain("splitByChar('/', log_attributes['request.pathname'])[5]");
  });

  it('groups by family rather than aggregating everything into one row', () => {
    expect(SQL).toContain('group by route_family');
  });
});

describe('analyse', () => {
  const rows = [
    {
      route_family: 'health',
      requests: 20,
      errors_5xx: 0,
      unauthorized: 0,
      error_rate_pct: 0,
      p50_ms: 1497,
      p95_ms: 2363,
      max_ms: 2549,
    },
    {
      route_family: 'publications',
      requests: 100,
      errors_5xx: 5,
      unauthorized: 0,
      error_rate_pct: 5,
      p50_ms: 900,
      p95_ms: 6000,
      max_ms: 9000,
    },
  ];

  it('reports the overall error rate across families', () => {
    const out = call(`m.analyse(${JSON.stringify(rows)})`) as {
      totalRequests: number;
      totalErrors: number;
      overallErrorRatePct: number;
    };
    expect(out.totalRequests).toBe(120);
    expect(out.totalErrors).toBe(5);
    expect(out.overallErrorRatePct).toBeCloseTo(4.17, 1);
  });

  it('flags a family that breaches the error-rate or p95 budget', () => {
    const out = call(`m.analyse(${JSON.stringify(rows)})`) as {
      breaches: Array<{ family: string; metric: string }>;
    };
    const flagged = out.breaches.map((b) => `${b.family}:${b.metric}`);
    expect(flagged).toContain('publications:error_rate_pct');
    expect(flagged).toContain('publications:p95_ms');
    // health is slow but within the p95 budget and has no errors.
    expect(flagged.some((f) => f.startsWith('health:'))).toBe(false);
  });

  it('returns a clean summary for a healthy window rather than throwing', () => {
    const out = call('m.analyse([])') as { totalRequests: number; overallErrorRatePct: number };
    expect(out.totalRequests).toBe(0);
    expect(out.overallErrorRatePct).toBe(0);
  });
});

describe('coldStartFloor', () => {
  it('reads the platform floor off the static /health handler', () => {
    // /health does no IO at all, so its latency IS boot + platform overhead.
    // Every other family pays it before doing any work of its own, which is why
    // it is surfaced separately instead of being one row among many.
    const out = call(
      `m.coldStartFloor([{route_family:'health',requests:20,p50_ms:1497,p95_ms:2363}])`,
    ) as { p50Ms: number; p95Ms: number };
    expect(out.p50Ms).toBe(1497);
    expect(out.p95Ms).toBe(2363);
  });

  it('returns null when the window contains no health probe', () => {
    expect(call(`m.coldStartFloor([{route_family:'auth',requests:1}])`)).toBeNull();
  });
});
