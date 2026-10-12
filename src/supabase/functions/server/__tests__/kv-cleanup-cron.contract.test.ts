/**
 * POST /kv-cleanup/cron — the nightly pg_cron job's endpoint.
 *
 * Until 2026-10-12 nothing scheduled this route: KV cleanup ran only from a
 * poller in an open admin browser tab. It is now driven by the
 * `kv-cleanup-nightly` job (supabase/cron/kv-cleanup-jobs.sql), which sends the
 * Vault-backed `x-nw-cron-auth` token. Pinned here:
 *   - the route is behind `requireCronAuth` (not the inline service-role compare
 *     that left every other scheduled job answering 401 in August);
 *   - without the cron credential nothing is deleted;
 *   - with it, cleanup runs live with the documented retention.
 * `cron-auth.ts` itself (the Vault oracle and the bearer fallback) is covered by
 * cron-auth.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cron = vi.hoisted(() => ({
  requireCronAuth: vi.fn(
    async (
      c: {
        req: { header: (name: string) => string | undefined };
        json: (b: unknown, s: number) => Response;
      },
      next: () => Promise<void>,
    ) =>
      c.req.header('x-nw-cron-auth') === 'the-cron-token'
        ? next()
        : c.json({ error: 'Unauthorized — cron auth required', code: 'CRON_AUTH_REQUIRED' }, 401),
  ),
}));
vi.mock('../cron-auth.ts', () => cron);

const cleanup = vi.hoisted(() => ({
  runKvCleanup: vi.fn(async () => ({ totalKeysFound: 3, totalKeysDeleted: 2, durationMs: 5 })),
  getLastCleanupRun: vi.fn(async () => null),
}));
vi.mock('../kv-cleanup-service.ts', () => cleanup);

vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return { requireAdmin: makeRoleGate(['admin', 'super_admin'], 'ADMIN_REQUIRED') };
});
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const app = (await import('../kv-cleanup-routes.ts')).default;

const runCron = (headers: Record<string, string> = {}) =>
  app.request('/cron', { method: 'POST', headers });

beforeEach(() => {
  cleanup.runKvCleanup.mockClear();
  cron.requireCronAuth.mockClear();
});

describe('POST /kv-cleanup/cron', () => {
  it('refuses a request without the cron credential and deletes nothing', async () => {
    const res = await runCron();
    expect(res.status).toBe(401);
    expect(cleanup.runKvCleanup).not.toHaveBeenCalled();
  });

  it('refuses a wrong cron credential', async () => {
    const res = await runCron({ 'x-nw-cron-auth': 'not-the-token' });
    expect(res.status).toBe(401);
    expect(cleanup.runKvCleanup).not.toHaveBeenCalled();
  });

  it('runs a live cleanup with the documented retention for the cron credential', async () => {
    const res = await runCron({ 'x-nw-cron-auth': 'the-cron-token' });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, totalKeysDeleted: 2 });
    expect(cleanup.runKvCleanup).toHaveBeenCalledWith({
      dryRun: false,
      retentionDays: 90,
      auditRetentionDays: 365,
    });
    expect(cron.requireCronAuth).toHaveBeenCalledTimes(1);
  });
});
