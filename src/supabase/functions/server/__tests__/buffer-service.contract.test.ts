/**
 * buffer-service.ts — Contract Tests
 * ==================================
 *
 * Pins the wire shape the app sends Buffer and how it reads the answer:
 *   - bearer auth from BUFFER_API_KEY, one POST per call, `{ query, variables }`;
 *   - GraphQL errors and non-success mutation unions become APIError (502),
 *     never a half-shaped object;
 *   - pagination on `posts` follows `pageInfo.endCursor` and stops at the cap;
 *   - the vocabulary mapping Buffer ↔ app (twitter → x, sent → published).
 *
 * `fetch` is stubbed; nothing here reaches the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const env = vi.hoisted(() => new Map<string, string>([['BUFFER_API_KEY', 'test-key']]));

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (k: string) => env.get(k) },
  };
});

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import {
  bufferGraphql,
  bufferServiceToChannel,
  bufferStatusToAppStatus,
  channelToBufferService,
  createBufferPost,
  deleteBufferPost,
  getBufferAggregatedMetrics,
  getBufferOrganizationId,
  isBufferConfigured,
  listBufferChannels,
  listBufferPosts,
  resetBufferOrganizationCache,
} from '../buffer-service.ts';
import { APIError } from '../error.middleware.ts';

type Call = {
  url: string;
  init: RequestInit;
  body: { query: string; variables: Record<string, unknown> };
};
const calls: Call[] = [];
let responder: (call: Call) => unknown = () => ({ data: {} });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  calls.length = 0;
  resetBufferOrganizationCache();
  env.set('BUFFER_API_KEY', 'test-key');
  env.delete('BUFFER_ORGANIZATION_ID');
  env.delete('BUFFER_API_URL');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const call: Call = { url, init, body: JSON.parse(String(init.body)) };
      calls.push(call);
      const out = responder(call);
      return out instanceof Response ? out : jsonResponse(out);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('transport', () => {
  it('posts { query, variables } with the bearer key to the default endpoint', async () => {
    responder = () => ({
      data: {
        account: {
          id: 'a',
          email: 'e',
          timezone: 'Africa/Johannesburg',
          organizations: [{ id: 'o1', name: 'Org' }],
        },
      },
    });
    await bufferGraphql('query { account { id } }', { x: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.buffer.com');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(calls[0].body).toEqual({ query: 'query { account { id } }', variables: { x: 1 } });
  });

  it('honours BUFFER_API_URL (trailing slash trimmed)', async () => {
    env.set('BUFFER_API_URL', 'https://example.test/graphql/');
    responder = () => ({ data: { ok: true } });
    await bufferGraphql('{ ok }');
    expect(calls[0].url).toBe('https://example.test/graphql');
  });

  it('refuses to run without BUFFER_API_KEY', async () => {
    env.delete('BUFFER_API_KEY');
    expect(isBufferConfigured()).toBe(false);
    await expect(bufferGraphql('{ ok }')).rejects.toMatchObject({ code: 'BUFFER_CONFIG_ERROR' });
    expect(calls).toHaveLength(0);
  });

  it('turns an HTTP error into a 502 APIError', async () => {
    responder = () => jsonResponse({ message: 'nope' }, 401);
    const err = await bufferGraphql('{ ok }').catch((e) => e);
    expect(err).toBeInstanceOf(APIError);
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe('BUFFER_HTTP_ERROR');
  });

  it('turns GraphQL errors into a 502 APIError carrying the message', async () => {
    responder = () => ({ errors: [{ message: 'Field x does not exist' }] });
    const err = await bufferGraphql('{ ok }').catch((e) => e);
    expect(err.code).toBe('BUFFER_GRAPHQL_ERROR');
    expect(err.message).toContain('Field x does not exist');
  });

  it('rejects a non-JSON body', async () => {
    responder = () => new Response('<html>oops</html>', { status: 200 });
    await expect(bufferGraphql('{ ok }')).rejects.toMatchObject({ code: 'BUFFER_BAD_RESPONSE' });
  });

  it('wraps a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(bufferGraphql('{ ok }')).rejects.toMatchObject({ code: 'BUFFER_UNREACHABLE' });
  });
});

describe('organisation resolution', () => {
  it('prefers BUFFER_ORGANIZATION_ID and makes no call', async () => {
    env.set('BUFFER_ORGANIZATION_ID', 'env-org');
    expect(await getBufferOrganizationId()).toBe('env-org');
    expect(calls).toHaveLength(0);
  });

  it('falls back to the first organisation and memoises it', async () => {
    responder = () => ({
      data: {
        account: {
          id: 'a',
          email: 'e',
          timezone: null,
          organizations: [
            { id: 'first', name: 'A' },
            { id: 'second', name: 'B' },
          ],
        },
      },
    });
    expect(await getBufferOrganizationId()).toBe('first');
    expect(await getBufferOrganizationId()).toBe('first');
    expect(calls).toHaveLength(1);
  });

  it('fails clearly when the account has no organisation', async () => {
    responder = () => ({
      data: { account: { id: 'a', email: 'e', timezone: null, organizations: [] } },
    });
    await expect(getBufferOrganizationId()).rejects.toMatchObject({
      code: 'BUFFER_NO_ORGANIZATION',
    });
  });
});

describe('queries', () => {
  beforeEach(() => env.set('BUFFER_ORGANIZATION_ID', 'org-1'));

  it('lists channels for the organisation', async () => {
    responder = () => ({ data: { channels: [{ id: 'c1', service: 'linkedin', type: 'page' }] } });
    const channels = await listBufferChannels();
    expect(channels).toEqual([{ id: 'c1', service: 'linkedin', type: 'page' }]);
    expect(calls[0].body.variables).toEqual({ organizationId: 'org-1' });
  });

  it('pages through posts with the dueAt filter and stops when hasNextPage is false', async () => {
    let page = 0;
    responder = (call) => {
      page += 1;
      expect(call.body.variables.filter).toEqual({
        dueAt: { start: '2026-09-14T00:00:00.000Z', end: '2026-09-21T00:00:00.000Z' },
        channelIds: ['c1'],
        status: ['scheduled', 'sent'],
      });
      return {
        data: {
          posts: {
            edges: [{ node: { id: `p${page}`, status: 'scheduled' } }],
            pageInfo: { hasNextPage: page === 1, endCursor: page === 1 ? 'cur1' : null },
          },
        },
      };
    };
    const posts = await listBufferPosts({
      from: '2026-09-14T00:00:00.000Z',
      to: '2026-09-21T00:00:00.000Z',
      channelIds: ['c1'],
      statuses: ['scheduled', 'sent'],
    });
    expect(posts.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(calls[1].body.variables.after).toBe('cur1');
  });

  it('sends a null filter when nothing is filtered and caps the row count', async () => {
    responder = () => ({
      data: {
        posts: {
          edges: [{ node: { id: 'p1' } }, { node: { id: 'p2' } }],
          pageInfo: { hasNextPage: true, endCursor: 'x' },
        },
      },
    });
    const posts = await listBufferPosts({ limit: 2 });
    expect(posts).toHaveLength(2);
    expect(calls).toHaveLength(1);
    expect(calls[0].body.variables.filter).toBeNull();
    expect(calls[0].body.variables.first).toBe(2);
  });

  it('aggregates metrics over a window', async () => {
    responder = () => ({
      data: {
        aggregatedPostMetrics: {
          metricsUpdatedAt: '2026-09-10T00:00:00Z',
          metrics: [
            { name: 'Impressions', type: 'impressions', value: 12, unit: 'count', description: '' },
          ],
        },
      },
    });
    const out = await getBufferAggregatedMetrics({ from: 'a', to: 'b', channelIds: ['c1'] });
    expect(out.metrics[0].value).toBe(12);
    expect(calls[0].body.variables).toEqual({
      input: { organizationId: 'org-1', startDateTime: 'a', endDateTime: 'b', channelIds: ['c1'] },
    });
  });
});

describe('mutations', () => {
  it('creates a post and returns the success payload', async () => {
    responder = () => ({
      data: {
        createPost: {
          __typename: 'PostActionSuccess',
          post: { id: 'np', status: 'scheduled', dueAt: 'd', channelId: 'c1' },
        },
      },
    });
    const created = await createBufferPost({
      channelId: 'c1',
      text: 'hello',
      mode: 'customScheduled',
      dueAt: '2026-09-15T07:30:00+02:00',
      assets: [{ image: { url: 'https://x/y.png', metadata: { altText: 'alt' } } }],
      metadata: { instagram: { type: 'post', shouldShareToFeed: true } },
    });
    expect(created.id).toBe('np');
    const input = calls[0].body.variables.input as Record<string, unknown>;
    expect(input).toMatchObject({
      channelId: 'c1',
      text: 'hello',
      mode: 'customScheduled',
      schedulingType: 'automatic',
      dueAt: '2026-09-15T07:30:00+02:00',
      source: 'navigate-wealth-admin',
    });
    expect(input.assets).toHaveLength(1);
  });

  it('rejects a custom-scheduled post without dueAt before calling Buffer', async () => {
    await expect(
      createBufferPost({ channelId: 'c1', text: 't', mode: 'customScheduled' }),
    ).rejects.toMatchObject({ code: 'BUFFER_DUE_AT_REQUIRED' });
    expect(calls).toHaveLength(0);
  });

  it('turns a MutationError union member into a 502 with the message', async () => {
    responder = () => ({
      data: { createPost: { __typename: 'LimitReachedError', message: 'Plan limit reached' } },
    });
    const err = await createBufferPost({ channelId: 'c1', text: 't', mode: 'addToQueue' }).catch(
      (e) => e,
    );
    expect(err.code).toBe('BUFFER_CREATE_FAILED');
    expect(err.message).toContain('Plan limit reached');
  });

  it('deletes a post and surfaces a refusal', async () => {
    responder = () => ({ data: { deletePost: { __typename: 'DeletePostSuccess', id: 'p1' } } });
    await expect(deleteBufferPost('p1')).resolves.toBeUndefined();
    responder = () => ({
      data: {
        deletePost: { __typename: 'VoidMutationError', message: 'Cannot delete a sent post' },
      },
    });
    await expect(deleteBufferPost('p1')).rejects.toMatchObject({ code: 'BUFFER_DELETE_FAILED' });
  });
});

describe('vocabulary mapping', () => {
  it('maps services both ways', () => {
    expect(bufferServiceToChannel('twitter')).toBe('x');
    expect(bufferServiceToChannel('linkedin')).toBe('linkedin');
    expect(bufferServiceToChannel('instagram')).toBe('instagram');
    expect(bufferServiceToChannel('pinterest')).toBeNull();
    expect(channelToBufferService('x')).toBe('twitter');
    expect(channelToBufferService('linkedin')).toBe('linkedin');
  });

  it('maps post statuses to the app vocabulary', () => {
    expect(bufferStatusToAppStatus('sent')).toBe('published');
    expect(bufferStatusToAppStatus('error')).toBe('failed');
    expect(bufferStatusToAppStatus('draft')).toBe('draft');
    expect(bufferStatusToAppStatus('needs_approval')).toBe('pending_approval');
    expect(bufferStatusToAppStatus('scheduled')).toBe('scheduled');
    expect(bufferStatusToAppStatus('sending')).toBe('scheduled');
  });
});
