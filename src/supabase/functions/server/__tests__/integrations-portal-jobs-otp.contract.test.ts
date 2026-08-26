/**
 * integrations-portal-jobs-routes.ts — OTP Relay & Worker Status Writes
 * ====================================================================
 *
 * The two routes a headless worker talks to while it is inside a provider's
 * portal. Both are written by something outside the app, so every field is
 * untrusted input.
 *
 *   - **The OTP relay.** A one-time passcode from the provider's 2FA is parked
 *     in KV for the worker to collect. It must be single-use, must expire, and
 *     must not accept arbitrary text. `GET .../otp` deletes the entry on the way
 *     out — that read-once behaviour is the whole security model, and a refactor
 *     that "helpfully" kept the value would silently break it while every
 *     happy-path test stayed green.
 *   - **Status writes.** The worker POSTs progress on a best-effort basis, so an
 *     unrecognised status is ignored rather than rejected — and the allowlist is
 *     the only thing stopping an arbitrary string becoming a job state the SPA
 *     has no rendering for. Messages and errors are length-capped because they
 *     go straight into a KV row.
 *
 * Shares `helpers/portal-jobs-harness.ts` with the other portal-job suites.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import {
  alignFileGlobal,
  kvStore,
  request,
  type RequestOptions,
} from './helpers/contract-harness.ts';
import {
  ALLOWED_STATUSES,
  JOB,
  TERMINAL_STATUSES,
  resetPortalJobMocks,
  seedJob,
} from './helpers/portal-jobs-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (k: string) => (k === 'NW_PORTAL_WORKER_SECRET' ? 'worker-secret' : 'test') },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

/**
 * `normaliseRunMode` is pure and belongs to the contract under test, so the
 * real one is kept; only the GitHub Actions dispatch and the storage upload are
 * replaced.
 */
vi.mock('../integrations-portal-runtime.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const { runtime: rt } = await import('./helpers/portal-jobs-harness.ts');
  return {
    ...actual,
    dispatchPortalGitHubAction: rt.dispatch,
    uploadPortalLiveView: rt.uploadLiveView,
  };
});

/** Role-aware `requireAdmin`, mirroring the shipped 401/403 split. */
vi.mock('../auth-mw.ts', async () => ({
  requireAdmin: (await import('./helpers/contract-harness.ts')).makeRoleGate(
    ['admin', 'super_admin', 'super-admin'],
    'FORBIDDEN',
  ),
}));

const app = (await import('../integrations-portal-jobs-routes.ts')).default;

/** See `contract-harness.ts` for why the `File` global has to be realigned. */
beforeAll(async () => {
  await alignFileGlobal();
});

const req = (path: string, opts: RequestOptions = {}) =>
  request(app, path, { as: 'admin', ...opts });

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  resetPortalJobMocks();
});

// ============================================================================
// OTP RELAY — read-once, time-bounded, format-bounded
// ============================================================================

const OTP_PATH = `/portal-jobs/${JOB}/otp`;

describe('otp relay', () => {
  it.each(['1234', '123456', '000000', 'AbC123', 'abcdefghijkl', '123456789012'])(
    'accepts %s',
    async (otp) => {
      seedJob();
      const res = await req(OTP_PATH, { method: 'POST', body: { otp } });
      expect(res.status).toBe(200);
      expect((kvStore.get(`portal-job-otp:${JOB}`) as { otp: string }).otp).toBe(otp);
    },
  );

  it.each([
    ['too short', '123'],
    ['too long', '1234567890123'],
    ['empty', ''],
    ['a hyphen', '12-34'],
    ['an inner space', '12 34'],
    ['punctuation', '1234!'],
    ['an emoji', '👍1234'],
    ['a newline', '1234\n5678'],
    ['an underscore', 'ab_cd'],
  ])('rejects an OTP with %s', async (_label, otp) => {
    seedJob();
    const res = await req(OTP_PATH, { method: 'POST', body: { otp } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('OTP must be 4 to 12 letters or numbers');
    // Nothing is parked for the worker to collect.
    expect(kvStore.has(`portal-job-otp:${JOB}`)).toBe(false);
  });

  it('trims surrounding whitespace before validating', async () => {
    seedJob();
    const res = await req(OTP_PATH, { method: 'POST', body: { otp: '  123456  ' } });
    expect(res.status).toBe(200);
    expect((kvStore.get(`portal-job-otp:${JOB}`) as { otp: string }).otp).toBe('123456');
  });

  it.each([
    ['a number', 123456],
    ['a missing field', undefined],
    ['null', null],
  ])('coerces %s rather than crashing', async (_label, otp) => {
    seedJob();
    const res = await req(OTP_PATH, { method: 'POST', body: { otp } });
    // 123456 stringifies to a valid OTP; the others become '' and are refused.
    expect(res.status).toBe(typeof otp === 'number' ? 200 : 400);
  });

  it('parks the OTP for ten minutes', async () => {
    seedJob();
    const before = Date.now();
    await req(OTP_PATH, { method: 'POST', body: { otp: '123456' } });
    const entry = kvStore.get(`portal-job-otp:${JOB}`) as { expiresAt: string };
    const ttl = new Date(entry.expiresAt).getTime() - before;
    // A provider OTP is typically valid for far less than this; the ceiling is
    // what stops a stale code sitting in KV indefinitely.
    expect(ttl).toBeGreaterThan(9 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(10 * 60 * 1000 + 1000);
  });

  it('hands the OTP to the worker exactly once', async () => {
    seedJob();
    await req(OTP_PATH, { method: 'POST', body: { otp: '123456' } });

    const first = await req(OTP_PATH);
    expect(await first.json()).toEqual({ success: true, otp: '123456' });

    // Read-once: the entry is deleted on the way out, so a second worker (or a
    // replayed request) cannot reuse a code that has already been consumed.
    const second = await req(OTP_PATH);
    expect(await second.json()).toEqual({ success: true, otp: null });
    expect(kvStore.has(`portal-job-otp:${JOB}`)).toBe(false);
  });

  it('refuses an expired OTP and clears it', async () => {
    seedJob();
    kvStore.set(`portal-job-otp:${JOB}`, {
      otp: '123456',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const res = await req(OTP_PATH);
    expect(await res.json()).toEqual({ success: true, otp: null, expired: true });
    expect(kvStore.has(`portal-job-otp:${JOB}`)).toBe(false);
  });

  it('reports no OTP for a job that never had one', async () => {
    seedJob();
    const res = await req(OTP_PATH);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, otp: null });
  });

  it.each([
    ['submit', 'POST'],
    ['collect', 'GET'],
  ])('%s returns 404 for a job that does not exist', async (_label, method) => {
    const res = await req('/portal-jobs/nope/otp', {
      method,
      ...(method === 'POST' ? { body: { otp: '123456' } } : {}),
    });
    expect(res.status).toBe(404);
    expect(kvStore.has('portal-job-otp:nope')).toBe(false);
  });

  it('does not leak the OTP back in the job it returns', async () => {
    seedJob();
    const res = await req(OTP_PATH, { method: 'POST', body: { otp: '987654' } });
    const payload = JSON.stringify(await res.json());
    // The submit response echoes the job; the code itself belongs only in the
    // worker's single read.
    expect(payload).not.toContain('987654');
    expect(payload).toContain('OTP supplied. Worker can continue.');
  });
});
// ============================================================================
// STATUS UPDATES — written by the worker, so every field is untrusted
// ============================================================================

const STATUS_PATH = `/portal-jobs/${JOB}/status`;

describe('status updates', () => {
  it.each(ALLOWED_STATUSES)('accepts the %s status', async (status) => {
    seedJob();
    const res = await req(STATUS_PATH, { method: 'POST', body: { status } });
    expect(res.status).toBe(200);
    expect((await res.json()).job.status).toBe(status);
  });

  it.each(['completed', 'done', 'succeeded', 'RUNNING', 'deleted', '', 'queued; drop table'])(
    'keeps the current status when handed %p',
    async (status) => {
      // An unrecognised status is ignored rather than rejected — the worker POSTs
      // progress on a best-effort basis and a 400 here would strand the job. The
      // allowlist is what stops an arbitrary string becoming a job state the SPA
      // has no rendering for.
      seedJob(JOB, { status: 'running' });
      const res = await req(STATUS_PATH, { method: 'POST', body: { status } });
      expect(res.status).toBe(200);
      expect((await res.json()).job.status).toBe('running');
    },
  );

  it.each(TERMINAL_STATUSES)('stamps completedAt for the terminal status %s', async (status) => {
    seedJob();
    const res = await req(STATUS_PATH, { method: 'POST', body: { status } });
    expect((await res.json()).job.completedAt).toBeTruthy();
  });

  it.each(ALLOWED_STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s)))(
    'leaves completedAt unset for the in-flight status %s',
    async (status) => {
      seedJob(JOB, { completedAt: '2026-01-01T00:00:00.000Z' });
      const res = await req(STATUS_PATH, { method: 'POST', body: { status } });
      // Note this CLEARS a previously stamped completedAt — a job that goes
      // back to running is not a finished job.
      expect((await res.json()).job.completedAt).toBeUndefined();
    },
  );

  it('stamps startedAt once and never moves it', async () => {
    seedJob(JOB, { startedAt: '2020-05-05T00:00:00.000Z' });
    const res = await req(STATUS_PATH, { method: 'POST', body: { status: 'extracting' } });
    expect((await res.json()).job.startedAt).toBe('2020-05-05T00:00:00.000Z');
  });

  it('does not stamp startedAt while the job is still queued', async () => {
    seedJob(JOB, { status: 'queued', startedAt: undefined });
    const res = await req(STATUS_PATH, { method: 'POST', body: { status: 'queued' } });
    expect((await res.json()).job.startedAt).toBeUndefined();
  });

  it('stamps startedAt on the first move out of queued', async () => {
    seedJob(JOB, { status: 'queued', startedAt: undefined });
    const res = await req(STATUS_PATH, { method: 'POST', body: { status: 'running' } });
    expect((await res.json()).job.startedAt).toBeTruthy();
  });

  it('truncates a worker message to 500 characters', async () => {
    // The worker's message goes straight into KV and onto the admin's screen.
    // Without the cap a runaway stack trace becomes an unbounded KV row.
    seedJob();
    const res = await req(STATUS_PATH, { method: 'POST', body: { message: 'm'.repeat(2000) } });
    expect((await res.json()).job.message).toHaveLength(500);
  });

  it('truncates a worker error to 1000 characters', async () => {
    seedJob();
    const res = await req(STATUS_PATH, { method: 'POST', body: { error: 'e'.repeat(5000) } });
    expect((await res.json()).job.error).toHaveLength(1000);
  });

  it.each([
    ['a number', 42],
    ['an object', { toString: 'evil' }],
    ['an array', ['a']],
    ['null', null],
  ])('keeps the existing message when handed %s', async (_label, message) => {
    seedJob(JOB, { message: 'Working' });
    const res = await req(STATUS_PATH, { method: 'POST', body: { message } });
    expect((await res.json()).job.message).toBe('Working');
  });

  it('accepts a numeric extractedRows and ignores anything else', async () => {
    seedJob(JOB, { extractedRows: 7 });
    const ok = await req(STATUS_PATH, { method: 'POST', body: { extractedRows: 12 } });
    expect((await ok.json()).job.extractedRows).toBe(12);

    seedJob(JOB, { extractedRows: 7 });
    const bad = await req(STATUS_PATH, { method: 'POST', body: { extractedRows: '99' } });
    expect((await bad.json()).job.extractedRows).toBe(7);
  });

  it('accumulates warnings, de-duplicates them and keeps the last twenty', async () => {
    seedJob(JOB, { warnings: ['first'] });
    const res = await req(STATUS_PATH, {
      method: 'POST',
      body: { warnings: ['first', 'second', 'third'] },
    });
    const job = (await res.json()).job;
    expect(job.warnings).toEqual(['first', 'second', 'third']);
    // `warning` is the singular the SPA renders — always the newest.
    expect(job.warning).toBe('third');
  });

  it('caps the warning history at twenty entries', async () => {
    seedJob(JOB, { warnings: [] });
    const res = await req(STATUS_PATH, {
      method: 'POST',
      body: { warnings: Array.from({ length: 30 }, (_, i) => `w${i}`) },
    });
    const job = (await res.json()).job;
    expect(job.warnings).toHaveLength(20);
    expect(job.warnings[0]).toBe('w10');
    expect(job.warning).toBe('w29');
  });

  it('accepts a single warning string as well as an array', async () => {
    seedJob(JOB, { warnings: [] });
    const res = await req(STATUS_PATH, { method: 'POST', body: { warning: 'careful' } });
    expect((await res.json()).job.warnings).toEqual(['careful']);
  });

  it('survives a body that is not JSON at all', async () => {
    // `c.req.json().catch(() => ({}))` — the worker retries on 5xx, so a
    // malformed body must be a no-op update, not an error loop.
    seedJob(JOB, { status: 'running' });
    const res = await req(STATUS_PATH, { method: 'POST', raw: '{not json' });
    expect(res.status).toBe(200);
    expect((await res.json()).job.status).toBe('running');
  });

  it('returns 404 for a job that does not exist', async () => {
    const res = await req('/portal-jobs/nope/status', {
      method: 'POST',
      body: { status: 'failed' },
    });
    expect(res.status).toBe(404);
  });

  it('persists the update, not just returns it', async () => {
    seedJob();
    await req(STATUS_PATH, { method: 'POST', body: { status: 'staged' } });
    expect((kvStore.get(`portal-job:${JOB}`) as { status: string }).status).toBe('staged');
  });
});
