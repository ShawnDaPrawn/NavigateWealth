/**
 * buffer-service.ts — Contract tests
 *
 * GraphQL client is exercised through mocked `fetch`. Credentials go through
 * the real repository + in-memory KV mock. Deno.env BUFFER_API_KEY is varied
 * per test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const env = vi.hoisted(() => ({ bufferKey: undefined as string | undefined }));
vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => undefined } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import { kvStore } from './helpers/contract-harness.ts';
import { APIError } from '../error.middleware.ts';

(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
  env: { get: (k: string) => (k === 'BUFFER_API_KEY' ? env.bufferKey : undefined) },
};

const { BufferService, bufferServicesForPlatform } = await import('../buffer-service.ts');

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function graphqlOk(data: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({ data }),
  });
}

const ACCOUNT = {
  account: {
    id: 'acc_1',
    email: 'hello@navigatewealth.co',
    name: 'Navigate Wealth',
    timezone: 'Africa/Johannesburg',
    organizations: [{ id: 'org_1', name: 'Navigate Wealth', channelCount: 3 }],
  },
};

const CHANNELS = {
  channels: [
    {
      id: 'ch_li',
      name: 'Navigate Wealth',
      service: 'linkedin',
      displayName: 'Navigate Wealth',
      isDisconnected: false,
    },
    {
      id: 'ch_ig',
      name: 'navigatewealth',
      service: 'instagram',
      displayName: 'navigatewealth',
      isDisconnected: false,
    },
  ],
};

beforeEach(() => {
  kvStore.clear();
  fetchMock.mockReset();
  env.bufferKey = undefined;
});

describe('bufferServicesForPlatform', () => {
  it('maps x and twitter onto Buffer twitter/x services', () => {
    expect(bufferServicesForPlatform('x')).toEqual(['twitter', 'x']);
    expect(bufferServicesForPlatform('twitter')).toEqual(['twitter', 'x']);
  });

  it('passes linkedin through', () => {
    expect(bufferServicesForPlatform('linkedin')).toEqual(['linkedin']);
  });
});

describe('BufferService.getStatus', () => {
  it('reports unconfigured when no env key and no stored credentials', async () => {
    const status = await new BufferService().getStatus();
    expect(status).toEqual({ configured: false, connected: false, canDisconnect: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses BUFFER_API_KEY and returns the account', async () => {
    env.bufferKey = 'buf_env_key';
    graphqlOk(ACCOUNT);
    const status = await new BufferService().getStatus();
    expect(status.connected).toBe(true);
    expect(status.source).toBe('env');
    expect(status.canDisconnect).toBe(false);
    expect(status.account?.email).toBe('hello@navigatewealth.co');
    expect(status.organizationId).toBe('org_1');
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe('Bearer buf_env_key');
  });

  it('returns configured-but-disconnected when GraphQL auth fails', async () => {
    env.bufferKey = 'buf_bad';
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: { get: () => null },
      json: async () => ({}),
    });
    const status = await new BufferService().getStatus();
    expect(status.configured).toBe(true);
    expect(status.connected).toBe(false);
    expect(status.error).toMatch(/invalid/i);
  });
});

describe('BufferService.connect / disconnect', () => {
  it('validates the key then stores it', async () => {
    graphqlOk(ACCOUNT);
    const status = await new BufferService().connect('buf_pasted_key', 'admin-1');
    expect(status.connected).toBe(true);
    expect(status.source).toBe('stored');
    expect(status.canDisconnect).toBe(true);
    expect(kvStore.get('buffer:credentials:account')).toMatchObject({
      apiKey: 'buf_pasted_key',
      connectedBy: 'admin-1',
      organizationId: 'org_1',
    });
  });

  it('refuses to overwrite an Edge Function secret', async () => {
    env.bufferKey = 'buf_env_key';
    await expect(new BufferService().connect('buf_other', 'admin-1')).rejects.toMatchObject({
      code: 'BUFFER_ENV_CONFIGURED',
    });
  });

  it('removes stored credentials', async () => {
    graphqlOk(ACCOUNT);
    const service = new BufferService();
    await service.connect('buf_pasted_key', 'admin-1');
    await service.disconnect('admin-1');
    expect(kvStore.get('buffer:credentials:account')).toBeUndefined();
  });
});

describe('BufferService.createPosts', () => {
  it('creates a post per channel and adds Instagram metadata', async () => {
    env.bufferKey = 'buf_env_key';
    graphqlOk(ACCOUNT); // createPosts → requireKey
    graphqlOk(CHANNELS);
    graphqlOk({
      createPost: { post: { id: 'p_li', channelId: 'ch_li', status: 'scheduled' } },
    });
    graphqlOk({
      createPost: { post: { id: 'p_ig', channelId: 'ch_ig', status: 'scheduled' } },
    });

    const results = await new BufferService().createPosts({
      channelIds: ['ch_li', 'ch_ig'],
      text: 'Hello from Navigate Wealth',
      mode: 'addToQueue',
    });
    expect(results).toHaveLength(2);
    expect(results[0].postId).toBe('p_li');

    const createCalls = fetchMock.mock.calls.filter(([, init]) => {
      const body = JSON.parse((init as { body: string }).body) as { query?: string };
      return typeof body.query === 'string' && body.query.includes('CreateBufferPost');
    });
    expect(createCalls).toHaveLength(2);
    const igBody = JSON.parse((createCalls[1][1] as { body: string }).body) as {
      variables: { input: { metadata?: { instagram?: { type: string } } } };
    };
    expect(igBody.variables.input.metadata?.instagram?.type).toBe('post');
  });

  it('surfaces MutationError messages', async () => {
    env.bufferKey = 'buf_env_key';
    graphqlOk(ACCOUNT);
    graphqlOk(CHANNELS);
    graphqlOk({ createPost: { message: 'Channel not found' } });
    await expect(
      new BufferService().createPosts({
        channelIds: ['ch_li'],
        text: 'Hello',
        mode: 'shareNow',
      }),
    ).rejects.toBeInstanceOf(APIError);
  });
});

describe('BufferService.pushLocalPost', () => {
  it('skips when Buffer is not configured', async () => {
    const result = await new BufferService().pushLocalPost(
      { platform: 'linkedin', content: 'Hi', media_urls: [] },
      'shareNow',
    );
    expect(result).toEqual({ pushed: false, postIds: [] });
  });

  it('pushes to matching connected channels', async () => {
    env.bufferKey = 'buf_env_key';
    graphqlOk(ACCOUNT); // pushLocalPost → listChannels requireKey
    graphqlOk(CHANNELS);
    graphqlOk(ACCOUNT); // createPosts requireKey
    graphqlOk(CHANNELS);
    graphqlOk({
      createPost: { post: { id: 'p_li', channelId: 'ch_li', status: 'sent' } },
    });

    const result = await new BufferService().pushLocalPost(
      { platform: 'linkedin', content: 'Market update', media_urls: [] },
      'shareNow',
    );
    expect(result.pushed).toBe(true);
    expect(result.postIds).toEqual(['p_li']);
  });
});

describe('BufferService.listPosts', () => {
  it('flattens connection edges', async () => {
    env.bufferKey = 'buf_env_key';
    graphqlOk(ACCOUNT);
    graphqlOk({
      posts: {
        edges: [
          {
            node: {
              id: 'p1',
              text: 'Queued',
              status: 'scheduled',
              dueAt: '2026-09-11T10:00:00.000Z',
              channelId: 'ch_li',
              channel: { id: 'ch_li', name: 'Navigate Wealth', service: 'linkedin' },
            },
          },
        ],
      },
    });
    const posts = await new BufferService().listPosts();
    expect(posts).toEqual([
      {
        id: 'p1',
        text: 'Queued',
        status: 'scheduled',
        dueAt: '2026-09-11T10:00:00.000Z',
        channelId: 'ch_li',
        channelService: 'linkedin',
        channelName: 'Navigate Wealth',
      },
    ]);
  });
});
