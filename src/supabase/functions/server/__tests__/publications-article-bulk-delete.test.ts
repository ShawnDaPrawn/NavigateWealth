/**
 * POST /publications/articles/bulk-delete
 * =======================================
 *
 * Mounts the real publications app (so a sibling `:param` route swallowing
 * the literal path would show up as a wrong answer) over an in-memory KV that
 * implements the guarded delete the way Postgres does: on the row's CURRENT
 * value, not on what the handler read a moment earlier.
 *
 * The property that matters most is the one the admin asked for when this was
 * written: a published article is never deleted by this endpoint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { stubModule, objStub, audit, vasco } = vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
  const stubModule = (overrides: Record<string, unknown> = {}) =>
    new Proxy(overrides, {
      get: (t, p) =>
        typeof p === 'string' && p in t
          ? t[p]
          : p === '__esModule'
            ? true
            : typeof p === 'symbol' || p === 'then'
              ? undefined
              : vi.fn(),
    });
  const objStub = () =>
    new Proxy(
      {},
      { get: (_t, p) => (typeof p === 'symbol' || p === 'then' ? undefined : vi.fn()) },
    );
  const audit = { record: vi.fn(async () => ({})) };
  const vasco = { removeArticlesFromIndexInBackground: vi.fn(async () => {}) };
  return { stubModule, objStub, audit, vasco };
});

const kvStore = new Map<string, unknown>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));
const kvMock = vi.hoisted(() => ({ mget: null as unknown }));

vi.mock('../kv_store.tsx', () => {
  const mget = vi.fn(async (ks: string[]) => ks.map((k) => clone(kvStore.get(k) ?? null)));
  kvMock.mget = mget;
  return {
    get: vi.fn(async (k: string) => clone(kvStore.get(k) ?? null)),
    set: vi.fn(async (k: string, v: unknown) => {
      kvStore.set(k, clone(v));
    }),
    del: vi.fn(async (k: string) => {
      kvStore.delete(k);
    }),
    mget,
    mset: vi.fn(async (ks: string[], vs: unknown[]) => {
      ks.forEach((k, i) => kvStore.set(k, clone(vs[i])));
    }),
    mdel: vi.fn(async (ks: string[]) => {
      ks.forEach((k) => kvStore.delete(k));
    }),
    // Postgres semantics: the guard reads the row as it is NOW.
    mdelUnlessFieldEquals: vi.fn(async (ks: string[], field: string, protectedValue: string) => {
      const removed: string[] = [];
      for (const k of ks) {
        const row = kvStore.get(k) as Record<string, unknown> | undefined;
        if (!row || row[field] == null || row[field] === protectedValue) continue;
        kvStore.delete(k);
        removed.push(k);
      }
      return removed;
    }),
    getByPrefix: vi.fn(async (p: string) => {
      const out: unknown[] = [];
      kvStore.forEach((v, k) => k.startsWith(p) && out.push(clone(v)));
      return out;
    }),
    listByPrefix: vi.fn(async (p: string) => {
      const out: { key: string; value: unknown }[] = [];
      kvStore.forEach((v, k) => k.startsWith(p) && out.push({ key: k, value: clone(v) }));
      return out;
    }),
  };
});

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../auth-mw.ts', () => {
  const guard = async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'admin-1');
    c.set('userRole', 'admin');
    await next();
  };
  return { requireAuth: guard, requireAdmin: guard };
});

vi.mock('../error.middleware.ts', () => ({ asyncHandler: (fn: any) => fn }));
vi.mock('../email-service.ts', () => ({ sendEmail: vi.fn(async () => ({ success: true })) }));
vi.mock('../article-notification-template.ts', () => ({
  createArticleNotificationEmail: vi.fn(() => ({ subject: '', html: '' })),
}));
vi.mock('../publications-notification-service.ts', () => stubModule());
vi.mock('../publications-email-engagement-service.ts', () => stubModule());
vi.mock('../vasco-index-sync.ts', () => stubModule(vasco));
vi.mock('../site-rebuild-trigger.ts', () => stubModule());
vi.mock('../publications-phase4-service.ts', () => ({
  TemplateService: objStub(),
  VersionService: objStub(),
}));
vi.mock('../admin-audit-service.ts', () => ({ AdminAuditService: audit }));
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ data: [], error: null }) }),
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}));

import publications from '../publications-routes.tsx';

const article = (id: string, status: string) => ({
  id,
  title: `Title ${id}`,
  slug: `slug-${id}`,
  status,
  published_at: status === 'published' ? '2026-01-01T00:00:00.000Z' : undefined,
});

function bulkDelete(body: unknown, auth = true) {
  return publications.request('/articles/bulk-delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer test' } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

describe('POST /articles/bulk-delete', () => {
  it('returns 401 without an Authorization header', async () => {
    kvStore.set('article:d1', article('d1', 'draft'));
    const res = await bulkDelete({ ids: ['d1'] }, false);
    expect(res.status).toBe(401);
    expect(kvStore.has('article:d1')).toBe(true);
  });

  it.each([
    ['no ids', {}],
    ['an empty list', { ids: [] }],
    ['an id that could address another key', { ids: ['d1:extra'] }],
    ['an id with a LIKE wildcard', { ids: ['d%'] }],
    ['more than 200 ids', { ids: Array.from({ length: 201 }, (_, i) => `a${i}`) }],
  ])('rejects %s with 400 and deletes nothing', async (_label, body) => {
    kvStore.set('article:d1', article('d1', 'draft'));
    const res = await bulkDelete(body);
    expect(res.status).toBe(400);
    expect(kvStore.has('article:d1')).toBe(true);
  });

  it('deletes drafts, keeps published articles, and reports missing ids', async () => {
    kvStore.set('article:d1', article('d1', 'draft'));
    kvStore.set('article:d2', article('d2', 'archived'));
    kvStore.set('article:p1', article('p1', 'published'));
    kvStore.set('article_tag_link:d1:t1', { article_id: 'd1', tag_id: 't1' });
    kvStore.set('article_tag_link:p1:t1', { article_id: 'p1', tag_id: 't1' });

    const res = await bulkDelete({ ids: ['d1', 'p1', 'd2', 'missing'] });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: { deleted: ['d1', 'd2'], kept: ['p1'], notFound: ['missing'] },
    });
    expect(kvStore.has('article:d1')).toBe(false);
    expect(kvStore.has('article:d2')).toBe(false);
    expect(kvStore.get('article:p1')).toMatchObject({ status: 'published' });
    expect(kvStore.has('article_tag_link:d1:t1')).toBe(false);
    expect(kvStore.has('article_tag_link:p1:t1')).toBe(true);
  });

  it('writes a tombstone per deleted article, attributed to the admin', async () => {
    kvStore.set('article:d1', article('d1', 'draft'));
    kvStore.set('article:p1', article('p1', 'published'));

    await bulkDelete({ ids: ['d1', 'p1'] });

    expect(kvStore.get('article_deleted:d1')).toMatchObject({
      id: 'd1',
      title: 'Title d1',
      slug: 'slug-d1',
      deleted_by: 'admin-1',
      previous_status: 'draft',
    });
    expect(kvStore.has('article_deleted:p1')).toBe(false);
  });

  it('keeps an article that is published between the read and the delete', async () => {
    // The handler reads `scheduled`; by the time the DELETE runs the scheduler
    // has published it. The guard in the DELETE statement must win.
    kvStore.set('article:s1', article('s1', 'published'));
    kvStore.set('article:d1', article('d1', 'draft'));
    (kvMock.mget as ReturnType<typeof vi.fn>).mockImplementationOnce(async (ks: string[]) =>
      ks.map((k) => (k === 'article:s1' ? article('s1', 'scheduled') : clone(kvStore.get(k)))),
    );

    const res = await bulkDelete({ ids: ['s1', 'd1'] });

    expect((await res.json()).data).toEqual({ deleted: ['d1'], kept: ['s1'], notFound: [] });
    expect(kvStore.get('article:s1')).toMatchObject({ status: 'published' });
    expect(kvStore.has('article_deleted:s1')).toBe(false);
  });

  it('records one audit entry and one index cleanup for the whole batch', async () => {
    kvStore.set('article:d1', article('d1', 'draft'));
    kvStore.set('article:d2', article('d2', 'draft'));

    await bulkDelete({ ids: ['d1', 'd2', 'd1'] });

    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'articles_bulk_deleted' }),
    );
    expect(vasco.removeArticlesFromIndexInBackground).toHaveBeenCalledTimes(1);
    expect(vasco.removeArticlesFromIndexInBackground).toHaveBeenCalledWith(
      ['d1', 'd2'],
      'article_bulk_deleted',
    );
  });

  it('touches nothing and records no audit entry when every id is published', async () => {
    kvStore.set('article:p1', article('p1', 'published'));

    const res = await bulkDelete({ ids: ['p1'] });

    expect((await res.json()).data).toEqual({ deleted: [], kept: ['p1'], notFound: [] });
    expect(kvStore.has('article:p1')).toBe(true);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('deletes a selection larger than one KV batch', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `d${i}`);
    ids.forEach((id) => kvStore.set(`article:${id}`, article(id, 'draft')));

    const res = await bulkDelete({ ids });

    expect((await res.json()).data.deleted).toHaveLength(120);
    expect([...kvStore.keys()].filter((k) => k.startsWith('article:'))).toEqual([]);
  });
});
