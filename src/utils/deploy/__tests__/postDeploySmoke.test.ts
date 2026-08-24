/**
 * Contract for the blocking post-deploy smoke (roadmap §8.1 / A8).
 *
 * The runner is a Node .mjs so the deploy workflow can invoke it without
 * `npm ci`. Vite's React plugin cannot transform that file, so this suite
 * drives it through a Node subprocess — the same runtime CI uses.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const scriptPath = resolve(repoRoot, 'scripts/post-deploy-smoke.mjs');
const scriptHref = pathToFileURL(scriptPath).href;
const workflowPath = resolve(repoRoot, '.github/workflows/deploy-supabase-function.yml');

type Probe = {
  name: string;
  path: string;
  expectedStatus: number;
  json?: Record<string, string>;
  auth: 'none' | 'anon';
};

function callSmoke(expression: string): unknown {
  const source = `
    import * as smoke from ${JSON.stringify(scriptHref)};
    const result = await (${expression});
    process.stdout.write(JSON.stringify(result));
  `;
  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    encoding: 'utf8',
    cwd: repoRoot,
  });
  return JSON.parse(stdout) as unknown;
}

describe('post-deploy smoke probes', () => {
  const probes = callSmoke('smoke.PROBES') as Probe[];

  it('covers liveness, readiness, and at least three unauthenticated gated routes', () => {
    const healthy = probes.filter((probe) => probe.expectedStatus === 200);
    const gatedUnauth = probes.filter(
      (probe) => probe.expectedStatus === 401 && probe.auth === 'none',
    );
    expect(healthy.map((probe) => probe.path).sort()).toEqual(['/health', '/health/ready']);
    expect(gatedUnauth.length).toBeGreaterThanOrEqual(3);
    const gatedPaths = gatedUnauth.map((probe) => probe.path).join(' ');
    expect(gatedPaths).toContain('/kv-store/');
    expect(gatedPaths).toContain('/documents/');
    expect(gatedPaths).toContain('/profile/');
  });

  it('proves the public anon key is still rejected as a user credential', () => {
    const anon = probes.filter((probe) => probe.auth === 'anon');
    expect(anon).toHaveLength(1);
    expect(anon[0].expectedStatus).toBe(401);
    expect(anon[0].json?.code).toBe('AUTH_INVALID');
  });

  it('never expects 200 on a gated path (that would certify an IDOR as healthy)', () => {
    for (const probe of probes) {
      if (probe.path.startsWith('/health')) continue;
      expect(probe.expectedStatus, probe.name).toBe(401);
    }
  });
});

describe('evaluateProbe', () => {
  it('accepts a matching 401 envelope', () => {
    expect(
      callSmoke(
        `smoke.evaluateProbe({ expectedStatus: 401, json: { code: 'AUTH_REQUIRED' } }, { status: 401, body: { code: 'AUTH_REQUIRED' } })`,
      ),
    ).toEqual([]);
  });

  it('rejects a 500 dressed as a gated-route success', () => {
    const failures = callSmoke(
      `smoke.evaluateProbe({ expectedStatus: 401, json: { code: 'AUTH_REQUIRED' } }, { status: 500, body: { code: 'AUTH_REQUIRED' } })`,
    ) as string[];
    expect(failures.some((failure) => failure.includes('status 500'))).toBe(true);
  });

  it('rejects a 200 on a gated probe even with the expected code', () => {
    const failures = callSmoke(
      `smoke.evaluateProbe({ expectedStatus: 401, json: { code: 'AUTH_REQUIRED' } }, { status: 200, body: { code: 'AUTH_REQUIRED' } })`,
    ) as string[];
    expect(failures.some((failure) => failure.includes('status 200'))).toBe(true);
  });

  it('rejects a healthy probe whose body lost its status', () => {
    const failures = callSmoke(
      `smoke.evaluateProbe({ expectedStatus: 200, json: { status: 'healthy' } }, { status: 200, body: { status: 'unready' } })`,
    ) as string[];
    expect(failures.join(' ')).toContain('unready');
  });

  it('rejects a non-JSON body when a JSON field is required', () => {
    const failures = callSmoke(
      `smoke.evaluateProbe({ expectedStatus: 401, json: { code: 'AUTH_REQUIRED' } }, { status: 401, body: 'Unauthorized' })`,
    ) as string[];
    expect(failures.join(' ')).toContain('not a JSON object');
  });
});

describe('retry policy', () => {
  it('retries isolate-boot failures, never 401', () => {
    expect(callSmoke('smoke.isRetryableStatus(502)')).toBe(true);
    expect(callSmoke('smoke.isRetryableStatus(503)')).toBe(true);
    expect(callSmoke('smoke.isRetryableStatus(504)')).toBe(true);
    expect(callSmoke('smoke.isRetryableStatus(401)')).toBe(false);
    expect(callSmoke('smoke.isRetryableStatus(200)')).toBe(false);
    expect(callSmoke('smoke.isRetryableStatus(500)')).toBe(false);
  });
});

describe('deploy workflow wires the smoke as blocking', () => {
  const workflow = readFileSync(workflowPath, 'utf8');

  it('runs post-deploy-smoke.mjs after the function deploy', () => {
    expect(workflow).toContain('scripts/post-deploy-smoke.mjs');
    expect(workflow).toMatch(/Deploy make-server-91ed8379[\s\S]*post-deploy-smoke\.mjs/);
  });

  it('does not continue-on-error the blocking smoke', () => {
    const blockingStep = workflow
      .split('Blocking post-deploy smoke')[1]
      ?.split('Post-deploy form prefill')[0];
    expect(blockingStep, 'blocking step missing').toBeTruthy();
    expect(blockingStep).not.toContain('continue-on-error');
  });
});
