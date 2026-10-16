/**
 * POST /kv-cleanup/run — the admin preview is the default, and a non-positive
 * retention cannot reach the nightly purge.
 *
 * The service treats `0` as a real window (`??` only replaces null), which
 * would delete every dated form copy. The route is what refuses that.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cleanup = vi.hoisted(() => ({
  runKvCleanup: vi.fn(async () => ({
    totalKeysFound: 3,
    totalKeysDeleted: 0,
    durationMs: 5,
  })),
  getLastCleanupRun: vi.fn(async () => null),
}));
vi.mock('../kv-cleanup-service.ts', () => cleanup);

const audit = vi.hoisted(() => ({
  record: vi.fn(async () => undefined),
}));
vi.mock('../admin-audit-service.ts', () => ({ AdminAuditService: audit }));

vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return { requireAdmin: makeRoleGate(['admin', 'super_admin'], 'ADMIN_REQUIRED') };
});
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../cron-auth.ts', () => ({
  requireCronAuth: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}));

const app = (await import('../kv-cleanup-routes.ts')).default;

const adminHeaders = {
  Authorization: 'Bearer test',
  'x-test-role': 'admin',
  'x-test-user': 'admin-1',
  'Content-Type': 'application/json',
};

function run(body?: string) {
  return app.request('/run', {
    method: 'POST',
    headers: adminHeaders,
    body,
  });
}

beforeEach(() => {
  cleanup.runKvCleanup.mockClear();
  audit.record.mockClear();
});

describe('POST /kv-cleanup/run', () => {
  it('previews with the documented retention when the body is missing or not JSON', async () => {
    const missing = await run();
    const garbage = await run('not-json');

    expect(missing.status).toBe(200);
    expect(garbage.status).toBe(200);
    expect(cleanup.runKvCleanup).toHaveBeenNthCalledWith(1, {
      dryRun: true,
      retentionDays: 90,
      auditRetentionDays: 365,
    });
    expect(cleanup.runKvCleanup).toHaveBeenNthCalledWith(2, {
      dryRun: true,
      retentionDays: 90,
      auditRetentionDays: 365,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        category: 'kv_cleanup',
        action: 'kv_cleanup_preview',
        severity: 'info',
      }),
    );
  });

  it('goes live only for boolean false', async () => {
    for (const body of [{}, { dryRun: true }, { dryRun: 'false' }, { dryRun: 0 }]) {
      await run(JSON.stringify(body));
    }
    await run(JSON.stringify({ dryRun: false }));

    const modes = cleanup.runKvCleanup.mock.calls.map((call) => call[0].dryRun);
    expect(modes).toEqual([true, true, true, true, false]);
    expect(audit.record).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'kv_cleanup_live', severity: 'warning' }),
    );
  });

  it('ignores a retention that is not a positive number', async () => {
    await run(
      JSON.stringify({
        dryRun: true,
        retentionDays: 0,
        auditRetentionDays: -1,
      }),
    );
    await run(
      JSON.stringify({
        retentionDays: null,
        auditRetentionDays: '30',
      }),
    );
    await run(JSON.stringify({ retentionDays: 30, auditRetentionDays: 10 }));

    expect(cleanup.runKvCleanup).toHaveBeenNthCalledWith(1, {
      dryRun: true,
      retentionDays: 90,
      auditRetentionDays: 365,
    });
    expect(cleanup.runKvCleanup).toHaveBeenNthCalledWith(2, {
      dryRun: true,
      retentionDays: 90,
      auditRetentionDays: 365,
    });
    expect(cleanup.runKvCleanup).toHaveBeenNthCalledWith(3, {
      dryRun: true,
      retentionDays: 30,
      auditRetentionDays: 10,
    });
  });

  it('does not start a cleanup without an admin session', async () => {
    const res = await app.request('/run', { method: 'POST' });

    expect(res.status).toBe(401);
    expect(cleanup.runKvCleanup).not.toHaveBeenCalled();
  });
});
