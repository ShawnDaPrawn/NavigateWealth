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
  surface: 'public' | 'gated';
  method?: 'GET' | 'POST';
  body?: unknown;
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
    timeout: 15_000,
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
    // Was a hardcoded ['/health','/health/ready'] list, which meant every
    // legitimate addition to the public surface failed this test and invited
    // someone to "fix" it by loosening the assertion. The invariant it actually
    // protects is the one below: a GATED route must never be probed for 200.
    expect(healthy.map((probe) => probe.path)).toEqual(
      expect.arrayContaining(['/health', '/health/ready']),
    );
    expect(gatedUnauth.length).toBeGreaterThanOrEqual(3);
    const gatedPaths = gatedUnauth.map((probe) => probe.path).join(' ');
    expect(gatedPaths).toContain('/kv-store/');
    expect(gatedPaths).toContain('/documents/');
    expect(gatedPaths).toContain('/profile/');
  });

  it('never expects 200 from a gated route, and never 401 from a public one', () => {
    // This is the assertion that stops the gate going vacuous. A probe table can
    // be neutered two ways: relax a gated route to expect 200 (the auth
    // regression it exists to catch then passes), or mark a public route as
    // gated (the §7.3 verify_jwt flip then "passes" while signup is broken for
    // every new customer). Both are structural, so both are checked here rather
    // than left to review.
    for (const probe of probes) {
      if (probe.surface === 'gated') {
        expect(probe.expectedStatus, `gated probe "${probe.name}" must not expect 200`).not.toBe(
          200,
        );
        expect(probe.expectedStatus, `gated probe "${probe.name}" must reject`).toBe(401);
      } else {
        expect(probe.surface, `probe "${probe.name}" must declare a surface`).toBe('public');
        expect(
          probe.expectedStatus,
          `public probe "${probe.name}" must not expect 401 — it is meant to be reachable`,
        ).not.toBe(401);
      }
    }
  });

  it("matches validateBody's real 400 envelope, read from the server source", () => {
    // The signup probe asserts a body shape produced by `rejection()` in
    // src/supabase/functions/server/validate.ts. Those two files have no import
    // relationship, so nothing stopped them drifting — and they DID drift: the
    // first version of this probe asserted `code: 'VALIDATION_ERROR'`, a field
    // that envelope has never had. Because this smoke is the BLOCKING gate on
    // every Edge Function deploy, that would have marked healthy deploys failed
    // after the revision was already live.
    //
    // Reading the server source here is deliberate. Asserting the literal
    // string in both places would agree with itself forever.
    const validateSrc = readFileSync(
      resolve(repoRoot, 'src/supabase/functions/server/validate.ts'),
      'utf8',
    );
    const envelope = validateSrc.match(/return c\.json\(\{\s*error:\s*'([^']+)'/);
    expect(envelope, 'could not find the validation rejection envelope').not.toBeNull();

    const signup = probes.find((p) => p.path === '/auth-signup/signup');
    expect(signup, 'signup probe missing').toBeDefined();
    expect(signup!.json).toBeDefined();
    expect(Object.keys(signup!.json!)).toEqual(['error']);
    expect(signup!.json!.error).toBe(envelope![1]);
  });

  it('covers the two public routes the verify_jwt flip would break first', () => {
    // Roadmap §7.2/§7.3. Signup is the canonical trap: the SPA posts to it
    // before any JWT exists, so a flip that forgets it breaks account creation
    // outright while every health check stays green.
    const publicPaths = probes.filter((p) => p.surface === 'public').map((p) => p.path);
    expect(publicPaths).toContain('/auth-signup/signup');
    expect(publicPaths.some((p) => p.includes('contact-form'))).toBe(true);
  });

  it('proves the public anon key is still rejected as a user credential', () => {
    const anon = probes.filter((probe) => probe.auth === 'anon');
    expect(anon).toHaveLength(1);
    expect(anon[0].expectedStatus).toBe(401);
    expect(anon[0].json?.code).toBe('AUTH_INVALID');
  });

  it('never expects 200 on a gated path (that would certify an IDOR as healthy)', () => {
    // Keyed on the probe's declared `surface`, not on a path prefix. The old
    // form ("anything not under /health must expect 401") could not express a
    // public route outside /health, so adding the signup and lead-gen probes
    // that §7.3 requires would have forced someone to weaken this instead.
    for (const probe of probes) {
      if (probe.surface !== 'gated') continue;
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

  it('keeps the request timeout armed while the response body is read', () => {
    const started = Date.now();
    expect(() =>
      callSmoke(`
        smoke.fetchWithRetry(
          'https://example.test/health',
          {},
          {
            timeoutMs: 80,
            retries: 0,
            fetchImpl: async () => ({
              status: 200,
              headers: { get: () => null },
              text: () => new Promise(() => {}),
            }),
          },
        )
      `),
    ).toThrow(/abort/i);
    expect(Date.now() - started).toBeLessThan(5_000);
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

  it('rolls back by dispatching a revision SHA, not --ref <sha>', () => {
    expect(workflow).toContain('github.event.inputs.revision || github.sha');
    expect(workflow).toContain('-f revision=<last-green-sha>');
    expect(workflow).not.toMatch(/workflow run deploy-supabase-function\.yml --ref <[^>]*sha/);
  });
});
