// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'npm:hono';
import { kvStore } from './helpers/contract-harness.ts';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
const verifiedAt = vi.hoisted(() => vi.fn());
vi.mock('../repositories/two-factor-session-repository.ts', () => ({
  sessionTwoFactorVerifiedAt: verifiedAt,
}));
vi.mock('../jwt-claims.ts', () => ({ readTokenSessionId: () => 'session-1' }));
import { lockState, requireUnlocked, unlock, IDLE_MS } from '../vault-unlock.ts';

function appFor(role = 'admin') {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('userId' as never, 'user-1' as never);
    c.set('userRole' as never, role as never);
    await next();
  });
  app.get('/state', async (c) => c.json(await lockState(c)));
  app.post('/unlock', async (c) => c.json({ result: await unlock(c) }));
  app.get('/secret', requireUnlocked, (c) => c.json({ ok: true }));
  return app;
}
const call = (app: Hono, path: string, method = 'GET') =>
  app.request(path, { method, headers: { Authorization: 'Bearer token' } });

beforeEach(() => {
  kvStore.clear();
  verifiedAt.mockReset();
});

describe('vault unlock', () => {
  it('refuses accounts without two-factor', async () => {
    const app = appFor();
    expect((await (await call(app, '/unlock', 'POST')).json()).result).toBe('no2fa');
    expect((await call(app, '/secret')).status).toBe(423);
  });

  it.each(['super_admin', 'super-admin'])(
    'lets a %s in without two-factor and never idles them out',
    async (role) => {
      const app = appFor(role);
      expect(await (await call(app, '/state')).json()).toEqual({
        unlocked: true,
        twoFactorEnabled: false,
        twoFactorRequired: false,
        expiresAt: null,
      });
      expect((await (await call(app, '/unlock', 'POST')).json()).result.unlocked).toBe(true);
      expect(verifiedAt).not.toHaveBeenCalled();
      vi.useFakeTimers();
      try {
        vi.setSystemTime(Date.now() + IDLE_MS * 4);
        expect((await call(app, '/secret')).status).toBe(200);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('still requires two-factor for a role that is not super admin', async () => {
    const app = appFor('admin');
    expect((await (await call(app, '/state')).json()).twoFactorRequired).toBe(true);
    expect((await call(app, '/secret')).status).toBe(423);
  });

  it('opens only after a fresh two-factor code and locks after 15 idle minutes', async () => {
    kvStore.set('security:user-1', { twoFactorEnabled: true });
    const app = appFor();
    verifiedAt.mockResolvedValue(Date.now() - 10 * 60 * 1000);
    expect((await (await call(app, '/unlock', 'POST')).json()).result).toBe('verify');
    verifiedAt.mockResolvedValue(Date.now() - 60 * 1000);
    expect((await (await call(app, '/unlock', 'POST')).json()).result.unlocked).toBe(true);
    expect((await call(app, '/secret')).status).toBe(200);
    vi.useFakeTimers();
    try {
      // Background polling is answered but does not keep the vault open.
      vi.setSystemTime(Date.now() + IDLE_MS - 60_000);
      expect((await call(app, '/secret?background=1')).status).toBe(200);
      vi.setSystemTime(Date.now() + 2 * 60_000);
      expect((await call(app, '/secret?background=1')).status).toBe(423);
      vi.setSystemTime(Date.now() + IDLE_MS + 1000);
      expect((await call(app, '/secret')).status).toBe(423);
      expect((await (await call(app, '/state')).json()).unlocked).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
