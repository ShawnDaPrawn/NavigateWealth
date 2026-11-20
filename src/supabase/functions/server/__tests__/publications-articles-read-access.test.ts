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
const { toPublicArticle } = await import('../publications-route-helpers.ts');

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

/**
 * Article records carry the research pipeline's working notes. Until 2026-11
 * every public read returned them, so anyone could read the notes, source
 * URLs and relevance score behind each published article.
 */
describe('public reads return public fields only', () => {
  const PRIVATE_FIELDS = {
    last_edited_by: 'auto:claude_daily_research',
    author_id: 'admin-user-id',
    scheduled_for: null,
    notify_on_publish: true,
    internal_research_notes: 'Lead was a trade-press article.',
    internal_source_url: 'https://example.com/source',
    internal_relevance_score: 72,
  };
  const PUBLIC_FIELDS = {
    id: 'pub',
    slug: 'pub-slug',
    status: 'published',
    title: 'Article pub',
    excerpt: 'The excerpt.',
    body: '<p>The body.</p>',
    press_category: 'company_news',
    published_at: '2026-09-02T00:00:00.000Z',
  };

  beforeEach(() => {
    kvStore.set('article:pub', {
      ...PUBLIC_FIELDS,
      ...PRIVATE_FIELDS,
      created_at: '2026-09-01T00:00:00.000Z',
    });
  });

  const recordFrom = async (res: Response) => {
    const { data } = (await res.json()) as { data: unknown };
    return (Array.isArray(data) ? data.find((a) => a.id === 'pub') : data) as Record<
      string,
      unknown
    >;
  };

  it.each([
    ['the public site list', '/articles?status=published', {}],
    ['a list with no status', '/articles', {}],
    ['a client session', '/articles', CLIENT],
    // A published-only list is never auth-checked, so even an admin gets the
    // public view there. The admin module lists without a status filter.
    ['an admin asking for published only', '/articles?status=published', ADMIN],
    ['a read by id', '/articles/pub', {}],
    ['a client read by id', '/articles/pub', CLIENT],
    ['a read by slug', '/articles/by-slug/pub-slug', {}],
    ['the legacy slug read', '/articles/slug/pub-slug', ADMIN],
  ])('%s', async (_label, path, headers) => {
    const res = await routes.request(path, { headers });
    expect(res.status).toBe(200);

    const record = await recordFrom(res);
    expect(record).toMatchObject(PUBLIC_FIELDS);
    for (const field of Object.keys(PRIVATE_FIELDS)) {
      expect(record).not.toHaveProperty(field);
    }
  });

  it.each([
    ['the unfiltered list', '/articles'],
    ['a read by id', '/articles/pub'],
  ])('an admin session still gets the whole record from %s', async (_label, path) => {
    const record = await recordFrom(await routes.request(path, { headers: ADMIN }));
    expect(record).toMatchObject({ ...PUBLIC_FIELDS, ...PRIVATE_FIELDS });
  });

  it('keeps a field nobody has declared public private by default', () => {
    expect(
      toPublicArticle({ id: 'x', title: 'T', internal_next_idea: 'n', some_new_field: 1 }),
    ).toEqual({ id: 'x', title: 'T' });
  });
});
