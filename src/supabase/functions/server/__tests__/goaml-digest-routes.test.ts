/**
 * GoAML digest router — auth + payload gate.
 *
 * The detector-visible guard is constantTimeEqual on app.use('*'). These
 * tests pin the runtime: a missing/wrong token is 401, a valid dedicated
 * token reaches the service, and credential-shaped fields never enter it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const env = vi.hoisted(() => ({
  NW_GOAML_DIGEST_TOKEN: 'digest-token',
  SUPABASE_URL: 'https://test',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
}));

vi.stubGlobal('Deno', {
  env: { get: (name: string) => env[name as keyof typeof env] ?? '' },
});

const processGoamlNotify = vi.hoisted(() =>
  vi.fn(async () => ({
    success: true,
    sent: true,
    outcome: 'sent',
    sastDate: '2026-09-05',
    updateCount: 1,
    addedCount: 1,
    removedCount: 0,
    recipientCount: 2,
    dryRun: false,
  })),
);
const getLatestSnapshot = vi.hoisted(() => vi.fn(async () => null));
const getLastSent = vi.hoisted(() => vi.fn(async () => null));
const isAuthorizedCronRequest = vi.hoisted(() => vi.fn(async () => false));

vi.mock('../goaml-digest-service.ts', () => ({
  processGoamlNotify: (...a: unknown[]) => processGoamlNotify(...a),
  getLatestSnapshot: (...a: unknown[]) => getLatestSnapshot(...a),
  getLastSent: (...a: unknown[]) => getLastSent(...a),
  toPublicSnapshot: (record: unknown) => record,
}));

vi.mock('../cron-auth.ts', () => ({
  isAuthorizedCronRequest: (...a: unknown[]) => isAuthorizedCronRequest(...a),
  requireCronAuth: async (_c: unknown, next: () => Promise<void>) => next(),
  CRON_AUTH_HEADER: 'x-nw-cron-auth',
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

const app = (await import('../goaml-digest-routes.ts')).default;

function notify(headers: Record<string, string>, body: unknown) {
  return app.request('/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  processGoamlNotify.mockClear();
  getLatestSnapshot.mockClear();
  getLastSent.mockClear();
  isAuthorizedCronRequest.mockReset();
  isAuthorizedCronRequest.mockResolvedValue(false);
  env.NW_GOAML_DIGEST_TOKEN = 'digest-token';
});

describe('auth', () => {
  it('rejects a request with no token', async () => {
    const res = await notify({}, { loginSucceeded: true, updates: [] });
    expect(res.status).toBe(401);
    expect(processGoamlNotify).not.toHaveBeenCalled();
  });

  it('rejects a wrong dedicated token', async () => {
    const res = await notify(
      { 'x-nw-goaml-digest-token': 'nope' },
      { loginSucceeded: true, updates: [] },
    );
    expect(res.status).toBe(401);
    expect(processGoamlNotify).not.toHaveBeenCalled();
  });

  it('accepts the dedicated digest token', async () => {
    const res = await notify(
      { 'x-nw-goaml-digest-token': 'digest-token' },
      {
        loginSucceeded: true,
        updates: [{ title: 'Notice', summary: 'Reminder' }],
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome).toBe('sent');
    expect(processGoamlNotify).toHaveBeenCalledTimes(1);
  });

  it('accepts the shared cron path when the dedicated token is absent', async () => {
    isAuthorizedCronRequest.mockResolvedValue(true);
    const res = await notify({}, { loginSucceeded: true, updates: [] });
    expect(res.status).toBe(200);
    expect(processGoamlNotify).toHaveBeenCalledTimes(1);
  });
});

describe('payload', () => {
  it('strips password/otp before the service sees the body', async () => {
    await notify(
      { 'x-nw-goaml-digest-token': 'digest-token' },
      {
        loginSucceeded: true,
        password: 'must-not-reach-service',
        otp: '123456',
        updates: [{ title: 'Notice', otp: '999999' }],
      },
    );
    const report = processGoamlNotify.mock.calls[0][0] as {
      password?: string;
      updates: Array<{ otp?: string; title: string }>;
    };
    expect(report.password).toBeUndefined();
    expect(report.updates[0]?.otp).toBeUndefined();
    expect(report.updates[0]?.title).toBe('Notice');
  });

  it('rejects a body that is not a scan report', async () => {
    const res = await notify({ 'x-nw-goaml-digest-token': 'digest-token' }, { hello: 'world' });
    expect(res.status).toBe(400);
    expect(processGoamlNotify).not.toHaveBeenCalled();
  });

  it('returns the latest snapshot for the next automation tick', async () => {
    getLatestSnapshot.mockResolvedValue({
      scannedAt: '2026-09-04T06:00:00.000Z',
      updates: [{ title: 'Yesterday' }],
    });
    const res = await app.request('/latest', {
      headers: { 'x-nw-goaml-digest-token': 'digest-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshot.updates[0].title).toBe('Yesterday');
  });
});
