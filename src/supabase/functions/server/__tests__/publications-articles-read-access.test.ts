/**
 * publications-articles-read-routes.ts — the public sees published articles only.
 * ============================================================================
 *
 * The list and by-id reads are public by design (the marketing site shows
 * articles to anonymous visitors), but they returned drafts, scheduled and
 * archived articles to anyone who left out `?status=published` — or asked for
 * `?status=draft`. They now serve published articles to everyone and the rest
 * only to an admin session, which the admin publications module has.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../auth-mw.ts', () => ({
  // A session's role arrives on a test header; no Authorization means no session.
  getAuthContext: async (c: { req: { header: (n: string) => string | undefined } }) => {
    if (!c.req.header('Authorization')) throw new Error('Unauthorized');
    return { role: c.req.header('x-test-role') ?? 'client', userId: 'u1' };
  },
}));

const { kvStore } = await import('./helpers/contract-harness.ts');
const routes = (await import('../publications-articles-read-routes.ts')).default;

const seed = (id: string, status: string) =>
  kvStore.set(`article:${id}`, {
    id,
    status,
    title: `Article ${id}`,
    created_at: '2026-09-01T00:00:00.000Z',
  });

const ids = async (res: Response) =>
  ((await res.json()) as { data: Array<{ id: string }> }).data.map((a) => a.id).sort();

const ADMIN = { Authorization: 'Bearer t', 'x-test-role': 'admin' };
const CLIENT = { Authorization: 'Bearer t', 'x-test-role': 'client' };

beforeEach(() => {
  kvStore.clear();
  seed('pub', 'published');
  seed('draft', 'draft');
  seed('sched', 'scheduled');
  seed('old', 'archived');
});

describe('GET /articles', () => {
  it.each([
    ['no status, no session', '/articles', {}],
    ['?status=draft, no session', '/articles?status=draft', {}],
    ['?status=draft, client session', '/articles?status=draft', CLIENT],
  ])('serves only published articles: %s', async (_label, path, headers) => {
    const res = await routes.request(path, { headers });
    expect(res.status).toBe(200);
    expect(await ids(res)).toEqual(['pub']);
  });

  it('serves an admin everything, or the status they ask for', async () => {
    expect(await ids(await routes.request('/articles', { headers: ADMIN }))).toEqual([
      'draft',
      'old',
      'pub',
      'sched',
    ]);
    expect(await ids(await routes.request('/articles?status=draft', { headers: ADMIN }))).toEqual([
      'draft',
    ]);
  });
});

describe('GET /articles/:id', () => {
  it('serves a published article to anyone', async () => {
    expect((await routes.request('/articles/pub')).status).toBe(200);
  });

  it.each(['draft', 'sched', 'old'])(
    '404s unpublished "%s" without an admin session',
    async (id) => {
      expect((await routes.request(`/articles/${id}`)).status).toBe(404);
      expect((await routes.request(`/articles/${id}`, { headers: CLIENT })).status).toBe(404);
    },
  );

  it('serves an unpublished article to an admin', async () => {
    expect((await routes.request('/articles/draft', { headers: ADMIN })).status).toBe(200);
  });
});
