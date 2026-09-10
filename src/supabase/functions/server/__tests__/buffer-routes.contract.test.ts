/**
 * buffer-routes.ts — auth + envelope contracts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const methods = vi.hoisted(() => ({
  getStatus: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  listChannels: vi.fn(),
  listPosts: vi.fn(),
  createPosts: vi.fn(),
}));

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('../auth-mw.ts', () => ({
  requireAuth: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    await next();
  },
  requireAdmin: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', c.req.header('x-test-user') ?? 'admin-1');
    await next();
  },
}));

vi.mock('../buffer-service.ts', () => ({
  BufferService: class {
    getStatus = methods.getStatus;
    connect = methods.connect;
    disconnect = methods.disconnect;
    listChannels = methods.listChannels;
    listPosts = methods.listPosts;
    createPosts = methods.createPosts;
  },
}));

import app from '../buffer-routes.ts';

const auth = { Authorization: 'Bearer test-token' };

async function jsonOf(response: Response) {
  return response.json() as Promise<{ success?: boolean; data?: unknown; error?: string }>;
}

beforeEach(() => {
  for (const fn of Object.values(methods)) fn.mockReset();
});

describe('buffer-routes auth', () => {
  it('rejects unauthenticated status reads', async () => {
    const res = await app.request('http://buffer.test/status');
    expect(res.status).toBe(401);
  });
});

describe('buffer-routes handlers', () => {
  it('GET /status returns the service payload', async () => {
    methods.getStatus.mockResolvedValue({
      configured: false,
      connected: false,
      canDisconnect: false,
    });
    const res = await app.request('http://buffer.test/status', { headers: auth });
    expect(res.status).toBe(200);
    const body = await jsonOf(res);
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ connected: false });
  });

  it('POST /connect stores the key via the service', async () => {
    methods.connect.mockResolvedValue({
      configured: true,
      connected: true,
      canDisconnect: true,
    });
    const res = await app.request('http://buffer.test/connect', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'buf_test_key_1' }),
    });
    expect(res.status).toBe(200);
    expect(methods.connect).toHaveBeenCalledWith('buf_test_key_1', 'admin-1', undefined);
  });

  it('POST /posts validates channelIds', async () => {
    const res = await app.request('http://buffer.test/posts', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hi', channelIds: [] }),
    });
    expect(res.status).toBe(400);
    expect(methods.createPosts).not.toHaveBeenCalled();
  });

  it('POST /posts creates on valid input', async () => {
    methods.createPosts.mockResolvedValue([{ postId: 'p1', channelId: 'ch1' }]);
    const res = await app.request('http://buffer.test/posts', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello from Navigate Wealth',
        channelIds: ['ch1'],
        mode: 'shareNow',
      }),
    });
    expect(res.status).toBe(201);
    const body = await jsonOf(res);
    expect(body.success).toBe(true);
  });

  it('GET /channels and GET /posts proxy the service', async () => {
    methods.listChannels.mockResolvedValue([{ id: 'ch1', name: 'LI', service: 'linkedin' }]);
    methods.listPosts.mockResolvedValue([]);
    const channels = await app.request('http://buffer.test/channels', { headers: auth });
    const posts = await app.request('http://buffer.test/posts', { headers: auth });
    expect(channels.status).toBe(200);
    expect(posts.status).toBe(200);
  });

  it('POST /disconnect calls the service', async () => {
    methods.disconnect.mockResolvedValue(undefined);
    const res = await app.request('http://buffer.test/disconnect', {
      method: 'POST',
      headers: auth,
    });
    expect(res.status).toBe(200);
    expect(methods.disconnect).toHaveBeenCalledWith('admin-1');
  });
});
