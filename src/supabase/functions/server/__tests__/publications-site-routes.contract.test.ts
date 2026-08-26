/**
 * publications-site-routes.ts + publications-phase4-service.ts — Contract Tests
 * ============================================================================
 *
 * Covers the content-template store, article version history, the public press
 * surface, and team/careers management as one stack: the routes run against the
 * REAL TemplateService and VersionService, which run against an in-memory KV.
 * Only the IO boundary is mocked (KV, logger, auth middleware, error handler).
 *
 * This is deliberately NOT how `publications-routes.contract.test.ts` mounts
 * the same routes — that suite stubs both services to assert mounting and auth,
 * so it never executes a line of either service. Running them for real is what
 * makes the version-history invariants (numbering, pruning, restore) testable
 * at all.
 *
 * Two things the KV mock has to get right or whole code paths go untested:
 *
 *   1. `listByPrefix` must honour `limit` and `startAfter`. `listAllVersionRows`
 *      pages in batches of 200 and stops when a batch comes back short — a mock
 *      that returns everything at once makes the loop exit on the first pass and
 *      the paging branch never runs.
 *   2. `asyncHandler` must actually try/catch. Half these routes have no
 *      try/catch of their own and rely on it for their 500; a pass-through stub
 *      turns a route error into an unhandled rejection that Hono renders as its
 *      own 500, which passes for the wrong reason.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

// --------------------------------------------------------------------------
// KV: the shared harness mock, wrapped so a test can make one read explode
// --------------------------------------------------------------------------

/** Set when a test wants a KV call to blow up, to reach a route's catch block. */
let kvFailure: { on: 'getByPrefix' | 'get' | 'set' | 'mdel'; prefix?: string } | null = null;

vi.mock('../kv_store.tsx', async () => {
  const { makeKvMock } = await import('./helpers/contract-harness.ts');
  const real = makeKvMock();
  const guard =
    (op: 'getByPrefix' | 'get' | 'set' | 'mdel', fn: (...a: any[]) => Promise<unknown>) =>
    async (first: unknown, ...rest: unknown[]) => {
      const target = typeof first === 'string' ? first : '';
      if (kvFailure?.on === op && (!kvFailure.prefix || target.startsWith(kvFailure.prefix))) {
        throw new Error(`kv.${op} exploded`);
      }
      return fn(first, ...rest);
    };
  return {
    ...real,
    get: guard('get', real.get),
    set: guard('set', real.set),
    getByPrefix: guard('getByPrefix', real.getByPrefix),
    mdel: guard('mdel', real.mdel),
  };
});

vi.mock('../stderr-logger.ts', async () => {
  const { makeLoggerMock } = await import('./helpers/contract-harness.ts');
  return makeLoggerMock();
});

vi.mock('../auth-mw.ts', () => ({
  requireAdmin: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'admin-1');
    c.set('userRole', 'admin');
    await next();
  },
  requireAuth: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'admin-1');
    await next();
  },
}));

// Faithful to the real wrapper: catch and render a 500 envelope.
vi.mock('../error.middleware.ts', () => ({
  asyncHandler: (fn: any) => async (c: any) => {
    try {
      return await fn(c);
    } catch {
      return c.json({ message: 'An unexpected error occurred', code: 'INTERNAL_ERROR' }, 500);
    }
  },
}));

import { kvStore } from './helpers/contract-harness.ts';
import siteRoutes from '../publications-site-routes.ts';
import { TemplateService, VersionService } from '../publications-phase4-service.ts';

const ADMIN = { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' };

const call = (
  method: string,
  path: string,
  opts: { body?: unknown; auth?: boolean } = { auth: true },
) =>
  siteRoutes.fetch(
    new Request(`http://x${path}`, {
      method,
      headers: opts.auth === false ? { 'Content-Type': 'application/json' } : ADMIN,
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    }),
  );

const json = async (r: Response) => (await r.json()) as any;

beforeEach(() => {
  kvStore.clear();
  kvFailure = null;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ==========================================================================
// Auth
// ==========================================================================
describe('publications-site-routes — admin guard', () => {
  it.each([
    ['POST', '/templates/seed'],
    ['GET', '/templates'],
    ['POST', '/templates'],
    ['GET', '/templates/t1'],
    ['PUT', '/templates/t1'],
    ['DELETE', '/templates/t1'],
    ['GET', '/versions/a1'],
    ['POST', '/versions/a1'],
    ['POST', '/versions/a1/v1/restore'],
    ['GET', '/press/config'],
    ['PUT', '/press/config'],
    ['GET', '/team/admin'],
    ['POST', '/team/admin'],
    ['PUT', '/team/admin/m1'],
    ['DELETE', '/team/admin/m1'],
    ['GET', '/careers/admin'],
    ['POST', '/careers/admin'],
    ['PUT', '/careers/admin/j1'],
    ['DELETE', '/careers/admin/j1'],
  ])('%s %s is 401 without a Bearer token', async (method, path) => {
    const res = await call(method, path, { auth: false, body: method === 'GET' ? undefined : {} });
    expect(res.status).toBe(401);
  });

  it.each([
    ['GET', '/press/stats'],
    ['GET', '/press/articles'],
    ['GET', '/team'],
    ['GET', '/careers'],
  ])('%s %s stays public', async (method, path) => {
    const res = await call(method, path, { auth: false });
    expect(res.status).toBe(200);
  });
});

// ==========================================================================
// Templates
// ==========================================================================
describe('content templates', () => {
  it('creates a template with defaults filled in', async () => {
    const res = await call('POST', '/templates', {
      body: { name: 'Market note', description: 'Monthly commentary', body: '<p>hi</p>' },
    });
    expect(res.status).toBe(201);
    const { data } = await json(res);
    expect(data).toMatchObject({
      name: 'Market note',
      icon: '📄',
      tags: [],
      is_system: false,
      sort_order: 0,
      is_active: true,
    });
    expect(data.id).toEqual(expect.any(String));
    expect(await kvStore.get(`pub_template:${data.id}`)).toBeTruthy();
  });

  it('rejects a template with no name', async () => {
    const res = await call('POST', '/templates', { body: { description: 'x', body: 'y' } });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/Name and description/);
  });

  it('rejects a template with no description', async () => {
    const res = await call('POST', '/templates', { body: { name: 'x', body: 'y' } });
    expect(res.status).toBe(400);
  });

  it('lists only active templates, sorted by sort_order', async () => {
    await TemplateService.create({ name: 'C', description: 'd', body: '', sort_order: 3 });
    const a = await TemplateService.create({
      name: 'A',
      description: 'd',
      body: '',
      sort_order: 1,
    });
    const hidden = await TemplateService.create({ name: 'Z', description: 'd', body: '' });
    await TemplateService.update(hidden.id, { is_active: false });

    const { data } = await json(await call('GET', '/templates'));
    expect(data.map((t: any) => t.name)).toEqual(['A', 'C']);
    expect(data[0].id).toBe(a.id);
  });

  it('?all=true includes inactive templates', async () => {
    const t = await TemplateService.create({ name: 'Z', description: 'd', body: '' });
    await TemplateService.update(t.id, { is_active: false });
    const { data } = await json(await call('GET', '/templates?all=true'));
    expect(data).toHaveLength(1);
    expect(data[0].is_active).toBe(false);
  });

  it('fetches a template by id', async () => {
    const t = await TemplateService.create({ name: 'One', description: 'd', body: 'b' });
    const { data } = await json(await call('GET', `/templates/${t.id}`));
    expect(data.name).toBe('One');
  });

  it('404s an unknown template', async () => {
    const res = await call('GET', '/templates/nope');
    expect(res.status).toBe(404);
    expect((await json(res)).error).toBe('Template not found');
  });

  it('updates a template and bumps updated_at', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const t = await TemplateService.create({ name: 'Before', description: 'd', body: 'b' });
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));

    const { data } = await json(
      await call('PUT', `/templates/${t.id}`, { body: { name: 'After' } }),
    );
    expect(data.name).toBe('After');
    expect(data.description).toBe('d');
    expect(data.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(data.updated_at).toBe('2026-01-02T00:00:00.000Z');
  });

  it('404s an update to an unknown template', async () => {
    const res = await call('PUT', '/templates/nope', { body: { name: 'x' } });
    expect(res.status).toBe(404);
  });

  it('deletes a template', async () => {
    const t = await TemplateService.create({ name: 'Gone', description: 'd', body: 'b' });
    const res = await call('DELETE', `/templates/${t.id}`);
    expect(res.status).toBe(200);
    expect(await TemplateService.get(t.id)).toBeNull();
  });

  it('404s a delete of an unknown template', async () => {
    const res = await call('DELETE', '/templates/nope');
    expect(res.status).toBe(404);
  });

  it('seeds the default template set, and seeding twice does not duplicate', async () => {
    const first = await json(await call('POST', '/templates/seed'));
    expect(first.data.length).toBeGreaterThan(0);
    const names = first.data.map((t: any) => t.name);

    const second = await json(await call('POST', '/templates/seed'));
    const all = await TemplateService.listAll();
    expect(all.map((t) => t.name).sort()).toEqual([...names].sort());
    expect(second.success).toBe(true);
  });

  it('seeded templates are all system templates', async () => {
    const { data } = await json(await call('POST', '/templates/seed'));
    expect(data.every((t: any) => t.is_system === true)).toBe(true);
  });

  it('500s a template list when KV fails', async () => {
    kvFailure = { on: 'getByPrefix', prefix: 'pub_template:' };
    const res = await call('GET', '/templates');
    expect(res.status).toBe(500);
    expect((await json(res)).success).toBe(false);
  });

  it('500s a template create when KV fails', async () => {
    kvFailure = { on: 'set', prefix: 'pub_template:' };
    const res = await call('POST', '/templates', {
      body: { name: 'n', description: 'd', body: 'b' },
    });
    expect(res.status).toBe(500);
  });

  it('500s a template fetch when KV fails', async () => {
    kvFailure = { on: 'get', prefix: 'pub_template:' };
    const res = await call('GET', '/templates/t1');
    expect(res.status).toBe(500);
  });

  it('500s a seed when KV fails', async () => {
    kvFailure = { on: 'getByPrefix', prefix: 'pub_template:' };
    const res = await call('POST', '/templates/seed');
    expect(res.status).toBe(500);
  });
});

// ==========================================================================
// Version history
// ==========================================================================
const article = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  title: 'Original title',
  subtitle: 'sub',
  slug: 'original-title',
  excerpt: 'ex',
  body: '<p>Hello <b>world</b> again</p>',
  category_id: 'c1',
  type_id: 't1',
  status: 'published',
  is_featured: false,
  created_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('article version history', () => {
  it('numbers the first version 1 and calls it the initial version', async () => {
    kvStore.set('article:a1', article());
    const res = await call('POST', '/versions/a1', { body: { edited_by: 'shawn' } });
    expect(res.status).toBe(201);
    const { data } = await json(res);
    expect(data.version_number).toBe(1);
    expect(data.change_summary).toBe('Initial version');
    expect(data.edited_by).toBe('shawn');
  });

  it('defaults edited_by to system when the body omits it', async () => {
    kvStore.set('article:a1', article());
    const { data } = await json(await call('POST', '/versions/a1', { body: {} }));
    expect(data.edited_by).toBe('system');
  });

  it('tolerates a non-JSON body', async () => {
    kvStore.set('article:a1', article());
    const res = await siteRoutes.fetch(
      new Request('http://x/versions/a1', { method: 'POST', headers: ADMIN, body: 'not json' }),
    );
    expect(res.status).toBe(201);
    expect((await json(res)).data.edited_by).toBe('system');
  });

  it('404s a version create for an unknown article', async () => {
    const res = await call('POST', '/versions/missing', { body: {} });
    expect(res.status).toBe(404);
    expect((await json(res)).error).toBe('Article not found');
  });

  it('strips HTML for the word and char counts', async () => {
    kvStore.set('article:a1', article({ body: '<p>Hello <b>world</b> again</p>' }));
    const { data } = await json(await call('POST', '/versions/a1', { body: {} }));
    expect(data.word_count).toBe(3);
    expect(data.char_count).toBe('Hello world again'.length);
  });

  it('counts an empty body as zero words', async () => {
    kvStore.set('article:a1', article({ body: '' }));
    const { data } = await json(await call('POST', '/versions/a1', { body: {} }));
    expect(data.word_count).toBe(0);
    expect(data.char_count).toBe(0);
  });

  it('counts a markup-only body as zero words', async () => {
    kvStore.set('article:a1', article({ body: '<p></p><br/>' }));
    const { data } = await json(await call('POST', '/versions/a1', { body: {} }));
    expect(data.word_count).toBe(0);
  });

  it('names which fields changed between versions', async () => {
    kvStore.set('article:a1', article());
    await call('POST', '/versions/a1', { body: {} });

    kvStore.set('article:a1', article({ title: 'New title', excerpt: 'new ex' }));
    const { data } = await json(await call('POST', '/versions/a1', { body: {} }));
    expect(data.version_number).toBe(2);
    expect(data.change_summary).toBe('Updated title, excerpt');
  });

  it('reports minor changes when nothing tracked moved', async () => {
    kvStore.set('article:a1', article());
    await call('POST', '/versions/a1', { body: {} });
    const { data } = await json(await call('POST', '/versions/a1', { body: {} }));
    expect(data.change_summary).toBe('Minor changes');
  });

  it('lists versions newest first', async () => {
    kvStore.set('article:a1', article());
    await call('POST', '/versions/a1', { body: {} });
    kvStore.set('article:a1', article({ title: 'Second' }));
    await call('POST', '/versions/a1', { body: {} });
    kvStore.set('article:a1', article({ title: 'Third' }));
    await call('POST', '/versions/a1', { body: {} });

    const { data } = await json(await call('GET', '/versions/a1'));
    expect(data.map((v: any) => v.version_number)).toEqual([3, 2, 1]);
  });

  it('keeps versions of different articles apart', async () => {
    kvStore.set('article:a1', article());
    kvStore.set('article:a2', article({ id: 'a2', title: 'Other' }));
    await call('POST', '/versions/a1', { body: {} });
    await call('POST', '/versions/a2', { body: {} });
    await call('POST', '/versions/a2', { body: {} });

    expect((await json(await call('GET', '/versions/a1'))).data).toHaveLength(1);
    expect((await json(await call('GET', '/versions/a2'))).data).toHaveLength(2);
  });

  it('returns an empty list for an article with no versions', async () => {
    const { data } = await json(await call('GET', '/versions/never-saved'));
    expect(data).toEqual([]);
  });

  it('500s a version list when KV fails', async () => {
    kvFailure = { on: 'getByPrefix', prefix: 'pub_version:' };
    const res = await call('GET', '/versions/a1');
    expect(res.status).toBe(500);
  });

  it('500s a version create when KV fails', async () => {
    kvStore.set('article:a1', article());
    kvFailure = { on: 'set', prefix: 'pub_version:' };
    const res = await call('POST', '/versions/a1', { body: {} });
    expect(res.status).toBe(500);
  });
});

describe('version numbering under a colliding clock', () => {
  it('gives two versions written in the same millisecond distinct keys and numbers', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-01T12:00:00.000Z'));
    kvStore.set('article:a1', article());

    await VersionService.createVersion('a1', article(), 'a');
    await VersionService.createVersion('a1', article({ title: 'B' }), 'b');

    const rows = [...kvStore.keys()].filter((k) => k.startsWith('pub_version:a1:'));
    expect(rows).toHaveLength(2);
    expect(new Set(rows).size).toBe(2);
    const versions = await VersionService.listVersions('a1');
    expect(versions.map((v) => v.version_number).sort()).toEqual([1, 2]);
  });

  it('derives the next number from the highest stored, not the row count', async () => {
    // The prune deletes rows, so a count regresses and hands back a number
    // already in use. Seed a gap the way a prune would leave one.
    kvStore.set('pub_version:a1:2026-01-01T00:00:00.000Z:x', {
      id: 'x',
      article_id: 'a1',
      version_number: 7,
      title: 'seeded',
      body: '',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    const created = await VersionService.createVersion('a1', article(), 'sys');
    expect(created.version_number).toBe(8);
  });

  it('ignores a non-numeric version_number when picking the next one', async () => {
    kvStore.set('pub_version:a1:2026-01-01T00:00:00.000Z:x', {
      id: 'x',
      article_id: 'a1',
      version_number: 'not a number',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    const created = await VersionService.createVersion('a1', article(), 'sys');
    expect(created.version_number).toBe(1);
  });
});

describe('version pruning', () => {
  const seedVersions = (count: number, articleId = 'a1') => {
    for (let i = 1; i <= count; i++) {
      const at = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
      kvStore.set(`pub_version:${articleId}:${at}:id-${String(i).padStart(4, '0')}`, {
        id: `id-${i}`,
        article_id: articleId,
        version_number: i,
        title: `v${i}`,
        body: '',
        created_at: at,
      });
    }
  };

  it('leaves fewer than 50 versions alone', async () => {
    seedVersions(10);
    await VersionService.createVersion('a1', article(), 'sys');
    expect(await VersionService.listVersions('a1')).toHaveLength(11);
  });

  it('caps the store at 50 once the 50th version lands', async () => {
    seedVersions(50);
    await VersionService.createVersion('a1', article(), 'sys');
    const kept = await VersionService.listVersions('a1');
    expect(kept).toHaveLength(50);
    // Oldest goes first: v1 is gone, v2 and the new v51 survive.
    expect(kept.some((v) => v.version_number === 1)).toBe(false);
    expect(kept.some((v) => v.version_number === 2)).toBe(true);
    expect(kept.some((v) => v.version_number === 51)).toBe(true);
  });

  it('prunes by created_at, not by version number', async () => {
    // A row whose number is high but whose timestamp is oldest must be the one
    // dropped — the number is not a reliable age once numbers have collided.
    seedVersions(50);
    kvStore.set('pub_version:a1:2020-01-01T00:00:00.000Z:ancient', {
      id: 'ancient',
      article_id: 'a1',
      version_number: 999,
      title: 'ancient',
      body: '',
      created_at: '2020-01-01T00:00:00.000Z',
    });

    await VersionService.createVersion('a1', article(), 'sys');
    const kept = await VersionService.listVersions('a1');
    expect(kept.some((v) => v.id === 'ancient')).toBe(false);
  });

  it('pages past the 100-row listByPrefix default when pruning a large backlog', async () => {
    seedVersions(260);
    await VersionService.createVersion('a1', article(), 'sys');
    const kept = await VersionService.listVersions('a1');
    // 261 rows read down to 49 kept plus the new one. A prune that stopped at
    // the 100-row default would have left ~160 behind.
    expect(kept).toHaveLength(50);
  });

  it('a failed prune 500s the create even though the version was already written', async () => {
    // Characterisation, not endorsement: the version is written BEFORE the
    // prune, and the prune's error is not caught, so the caller sees a 500 for
    // a version that is on file. A retry then writes a second copy.
    seedVersions(50);
    kvStore.set('article:a1', article());
    kvFailure = { on: 'mdel' };

    const res = await call('POST', '/versions/a1', { body: {} });
    expect(res.status).toBe(500);

    kvFailure = null;
    expect((await VersionService.listVersions('a1')).some((v) => v.version_number === 51)).toBe(
      true,
    );
  });

  it('prunes only the article it was called for', async () => {
    seedVersions(50, 'a1');
    seedVersions(50, 'a2');
    await VersionService.createVersion('a1', article(), 'sys');
    expect(await VersionService.listVersions('a2')).toHaveLength(50);
  });
});

describe('version restore', () => {
  it('restores a snapshot and keeps the article id', async () => {
    kvStore.set('article:a1', article());
    const v1 = (await json(await call('POST', '/versions/a1', { body: {} }))).data;

    kvStore.set('article:a1', article({ title: 'Edited later', excerpt: 'later' }));
    const res = await call('POST', `/versions/a1/${v1.id}/restore`);
    expect(res.status).toBe(200);
    const { data } = await json(res);
    expect(data.title).toBe('Original title');
    expect(data.excerpt).toBe('ex');
    expect(data.id).toBe('a1');
    expect(await kvStore.get('article:a1')).toMatchObject({ title: 'Original title' });
  });

  it('snapshots the pre-restore state as a new version first', async () => {
    kvStore.set('article:a1', article());
    const v1 = (await json(await call('POST', '/versions/a1', { body: {} }))).data;
    kvStore.set('article:a1', article({ title: 'Edited later' }));

    await call('POST', `/versions/a1/${v1.id}/restore`);

    const versions = await VersionService.listVersions('a1');
    expect(versions).toHaveLength(2);
    expect(versions[0].title).toBe('Edited later');
    expect(versions[0].edited_by).toBe('system');
  });

  it('404s a restore of an unknown version', async () => {
    kvStore.set('article:a1', article());
    const res = await call('POST', '/versions/a1/nope/restore');
    expect(res.status).toBe(404);
    expect((await json(res)).error).toBe('Version not found');
  });

  it('404s a restore when the article is gone', async () => {
    kvStore.set('article:a1', article());
    const v1 = (await json(await call('POST', '/versions/a1', { body: {} }))).data;
    kvStore.delete('article:a1');

    const res = await call('POST', `/versions/a1/${v1.id}/restore`);
    expect(res.status).toBe(404);
    expect((await json(res)).error).toBe('Article not found');
  });

  it('500s a restore when KV fails', async () => {
    kvStore.set('article:a1', article());
    const v1 = (await json(await call('POST', '/versions/a1', { body: {} }))).data;
    kvFailure = { on: 'getByPrefix', prefix: 'pub_version:' };
    const res = await call('POST', `/versions/a1/${v1.id}/restore`);
    expect(res.status).toBe(500);
  });
});

describe('deleteAllVersions', () => {
  it('removes every version and reports the count', async () => {
    kvStore.set('article:a1', article());
    await call('POST', '/versions/a1', { body: {} });
    await call('POST', '/versions/a1', { body: {} });

    expect(await VersionService.deleteAllVersions('a1')).toBe(2);
    expect(await VersionService.listVersions('a1')).toEqual([]);
  });

  it('reports zero for an article that never had versions', async () => {
    expect(await VersionService.deleteAllVersions('never')).toBe(0);
  });

  it('pages past 200 rows so nothing outlives the article', async () => {
    for (let i = 1; i <= 260; i++) {
      const at = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
      kvStore.set(`pub_version:a1:${at}:id-${String(i).padStart(4, '0')}`, {
        id: `id-${i}`,
        article_id: 'a1',
        version_number: i,
        created_at: at,
      });
    }
    expect(await VersionService.deleteAllVersions('a1')).toBe(260);
    expect([...kvStore.keys()].filter((k) => k.startsWith('pub_version:a1:'))).toEqual([]);
  });

  it('leaves other articles untouched', async () => {
    kvStore.set('article:a1', article());
    kvStore.set('article:a2', article({ id: 'a2' }));
    await call('POST', '/versions/a1', { body: {} });
    await call('POST', '/versions/a2', { body: {} });

    await VersionService.deleteAllVersions('a1');
    expect(await VersionService.listVersions('a2')).toHaveLength(1);
  });
});

// ==========================================================================
// Press config + public press surface
// ==========================================================================
describe('press config', () => {
  it('returns hard-coded defaults when nothing is configured', async () => {
    const { data } = await json(await call('GET', '/press/config'));
    expect(data).toEqual({ aum: 'R500 mil+', yearsInBusiness: '2+', combinedExperience: '55+' });
  });

  it('returns stored config over the defaults', async () => {
    kvStore.set('config:press_stats', { aum: 'R1 bil+', yearsInBusiness: '3+' });
    const { data } = await json(await call('GET', '/press/config'));
    expect(data.aum).toBe('R1 bil+');
    expect(data.yearsInBusiness).toBe('3+');
    expect(data.combinedExperience).toBe('55+');
  });

  it('merges a partial update into existing config', async () => {
    kvStore.set('config:press_stats', { aum: 'R1 bil+', combinedExperience: '60+' });
    const { data } = await json(
      await call('PUT', '/press/config', { body: { yearsInBusiness: '4+' } }),
    );
    expect(data).toMatchObject({
      aum: 'R1 bil+',
      combinedExperience: '60+',
      yearsInBusiness: '4+',
    });
    expect(data.updatedAt).toEqual(expect.any(String));
  });

  it('trims and stringifies incoming values', async () => {
    const { data } = await json(
      await call('PUT', '/press/config', { body: { aum: '  R2 bil+  ', yearsInBusiness: 5 } }),
    );
    expect(data.aum).toBe('R2 bil+');
    expect(data.yearsInBusiness).toBe('5');
  });

  it('leaves untouched fields alone when the body is empty', async () => {
    kvStore.set('config:press_stats', { aum: 'R1 bil+' });
    const { data } = await json(await call('PUT', '/press/config', { body: {} }));
    expect(data.aum).toBe('R1 bil+');
  });
});

describe('public press stats', () => {
  it('counts non-closed profiles as active clients', async () => {
    kvStore.set('user_profile:1', { accountStatus: 'active' });
    kvStore.set('user_profile:2', { accountStatus: 'closed' });
    kvStore.set('user_profile:3', {});

    const { data } = await json(await call('GET', '/press/stats', { auth: false }));
    expect(data.activeClients).toBe(2);
    expect(data.activeClientsLabel).toBe('2+');
  });

  it('formats a four-figure client count with a thousands separator', async () => {
    for (let i = 0; i < 1234; i++) kvStore.set(`user_profile:${i}`, { accountStatus: 'active' });
    const { data } = await json(await call('GET', '/press/stats', { auth: false }));
    expect(data.activeClientsLabel).toBe('1,234+');
  });

  it('pads the hundreds when the remainder is small', async () => {
    for (let i = 0; i < 1005; i++) kvStore.set(`user_profile:${i}`, { accountStatus: 'active' });
    const { data } = await json(await call('GET', '/press/stats', { auth: false }));
    expect(data.activeClientsLabel).toBe('1,005+');
  });

  it('falls back to a safe payload when KV fails, rather than erroring publicly', async () => {
    kvFailure = { on: 'getByPrefix', prefix: 'user_profile:' };
    const res = await call('GET', '/press/stats', { auth: false });
    expect(res.status).toBe(200);
    const { data } = await json(res);
    expect(data.activeClientsLabel).toBe('—');
    expect(data.aum).toBe('R500 mil+');
  });
});

describe('public press articles', () => {
  const pressArticle = (over: Record<string, unknown>) => ({
    status: 'published',
    press_category: 'news',
    title: 't',
    slug: 's',
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  });

  it('returns only published articles that carry a press category', async () => {
    kvStore.set('article:1', pressArticle({ id: '1' }));
    kvStore.set('article:2', pressArticle({ id: '2', status: 'draft' }));
    kvStore.set('article:3', pressArticle({ id: '3', press_category: undefined }));

    const { data } = await json(await call('GET', '/press/articles', { auth: false }));
    expect(data.map((a: any) => a.id)).toEqual(['1']);
  });

  it('filters by category, and treats "all" as no filter', async () => {
    kvStore.set('article:1', pressArticle({ id: '1', press_category: 'news' }));
    kvStore.set('article:2', pressArticle({ id: '2', press_category: 'awards' }));

    const filtered = await json(
      await call('GET', '/press/articles?category=awards', { auth: false }),
    );
    expect(filtered.data.map((a: any) => a.id)).toEqual(['2']);

    const all = await json(await call('GET', '/press/articles?category=all', { auth: false }));
    expect(all.data).toHaveLength(2);
  });

  it('sorts newest first, falling back to created_at when published_at is absent', async () => {
    kvStore.set(
      'article:old',
      pressArticle({ id: 'old', published_at: '2026-01-01T00:00:00.000Z' }),
    );
    kvStore.set(
      'article:new',
      pressArticle({ id: 'new', published_at: '2026-06-01T00:00:00.000Z' }),
    );
    kvStore.set('article:mid', pressArticle({ id: 'mid', created_at: '2026-03-01T00:00:00.000Z' }));

    const { data } = await json(await call('GET', '/press/articles', { auth: false }));
    expect(data.map((a: any) => a.id)).toEqual(['new', 'mid', 'old']);
  });

  it('does not leak the article body to the public surface', async () => {
    kvStore.set(
      'article:1',
      pressArticle({ id: '1', body: '<p>full text</p>', seo_title: 'seo', author_name: 'A' }),
    );
    const { data } = await json(await call('GET', '/press/articles', { auth: false }));
    expect(data[0]).not.toHaveProperty('body');
    expect(data[0]).not.toHaveProperty('seo_title');
    expect(data[0].author_name).toBe('A');
  });

  it('returns an empty list rather than an error when KV fails', async () => {
    kvFailure = { on: 'getByPrefix', prefix: 'article:' };
    const res = await call('GET', '/press/articles', { auth: false });
    expect(res.status).toBe(200);
    expect((await json(res)).data).toEqual([]);
  });
});

// ==========================================================================
// Team members
// ==========================================================================
describe('team members', () => {
  const createMember = (over: Record<string, unknown> = {}) =>
    call('POST', '/team/admin', {
      body: { name: 'Ada Lovelace', title: 'Adviser', ...over },
    });

  it('creates a member with trimmed values and defaults', async () => {
    const { data } = await json(
      await createMember({ name: '  Ada  ', credentials: ' CFP ', specialties: 'not-an-array' }),
    );
    expect(data).toMatchObject({
      name: 'Ada',
      title: 'Adviser',
      credentials: 'CFP',
      bio: '',
      specialties: [],
      sortOrder: 99,
      active: true,
    });
    expect(data.createdAt).toBe(data.updatedAt);
  });

  it.each([
    [{ name: '' }, 'Name is required (min 2 characters)'],
    [{ name: 'A' }, 'Name is required (min 2 characters)'],
    [{ name: 42 }, 'Name is required (min 2 characters)'],
    [{ title: '' }, 'Title/role is required'],
  ])('rejects a bad create body %j', async (over, message) => {
    const res = await createMember(over as Record<string, unknown>);
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe(message);
  });

  it('lists active members publicly, sorted by sortOrder', async () => {
    await createMember({ name: 'Third', sortOrder: 3 });
    await createMember({ name: 'First', sortOrder: 1 });
    const hidden = (await json(await createMember({ name: 'Hidden' }))).data;
    await call('DELETE', `/team/admin/${hidden.id}`);

    const { data } = await json(await call('GET', '/team', { auth: false }));
    expect(data.map((m: any) => m.name)).toEqual(['First', 'Third']);
  });

  it('the admin list includes soft-deleted members and a total', async () => {
    const m = (await json(await createMember())).data;
    await call('DELETE', `/team/admin/${m.id}`);
    const body = await json(await call('GET', '/team/admin'));
    expect(body.total).toBe(1);
    expect(body.data[0].active).toBe(false);
  });

  it('skips malformed rows rather than rendering them', async () => {
    kvStore.set('team_member:junk', { name: 'no id' });
    kvStore.set('team_member:null', null);
    await createMember();
    const { data } = await json(await call('GET', '/team', { auth: false }));
    expect(data).toHaveLength(1);
  });

  it('updates a member and leaves omitted fields alone', async () => {
    const m = (await json(await createMember({ bio: 'original bio' }))).data;
    const { data } = await json(
      await call('PUT', `/team/admin/${m.id}`, { body: { title: 'Director' } }),
    );
    expect(data.title).toBe('Director');
    expect(data.bio).toBe('original bio');
    expect(data.name).toBe('Ada Lovelace');
  });

  it('can reactivate a soft-deleted member', async () => {
    const m = (await json(await createMember())).data;
    await call('DELETE', `/team/admin/${m.id}`);
    const { data } = await json(
      await call('PUT', `/team/admin/${m.id}`, { body: { active: true } }),
    );
    expect(data.active).toBe(true);
    expect((await json(await call('GET', '/team', { auth: false }))).data).toHaveLength(1);
  });

  it.each([
    [{ name: '' }, 'Name is required (min 2 characters)'],
    [{ name: '   ' }, 'Name is required (min 2 characters)'],
    [{ name: 'A' }, 'Name is required (min 2 characters)'],
    [{ name: 42 }, 'Name is required (min 2 characters)'],
    [{ title: '' }, 'Title/role is required'],
    [{ title: 7 }, 'Title/role is required'],
  ])('rejects the same bad values on update that create rejects: %j', async (over, message) => {
    const m = (await json(await createMember())).data;
    const res = await call('PUT', `/team/admin/${m.id}`, { body: over });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe(message);
    // And the stored row is untouched.
    expect((kvStore.get(`team_member:${m.id}`) as any).name).toBe('Ada Lovelace');
  });

  it('treats an explicit null as "leave this field alone"', async () => {
    const m = (await json(await createMember())).data;
    const { data } = await json(
      await call('PUT', `/team/admin/${m.id}`, { body: { name: null, title: null } }),
    );
    expect(data.name).toBe('Ada Lovelace');
    expect(data.title).toBe('Adviser');
  });

  it('404s an update or delete of an unknown member', async () => {
    expect((await call('PUT', '/team/admin/nope', { body: {} })).status).toBe(404);
    expect((await call('DELETE', '/team/admin/nope')).status).toBe(404);
  });

  it('soft-deletes rather than removing the row', async () => {
    const m = (await json(await createMember())).data;
    const res = await call('DELETE', `/team/admin/${m.id}`);
    expect((await json(res)).message).toContain('Ada Lovelace');
    const stored = kvStore.get(`team_member:${m.id}`) as any;
    expect(stored.active).toBe(false);
    expect(stored.deletedAt).toEqual(expect.any(String));
  });
});

// ==========================================================================
// Careers / job listings
// ==========================================================================
describe('job listings', () => {
  const createListing = (over: Record<string, unknown> = {}) =>
    call('POST', '/careers/admin', {
      body: { title: 'Paraplanner', category: 'advice', ...over },
    });

  it('creates a listing with trimmed values and defaults', async () => {
    const { data } = await json(await createListing({ title: '  Paraplanner  ' }));
    expect(data).toMatchObject({
      title: 'Paraplanner',
      category: 'advice',
      location: 'Pretoria, South Africa',
      type: 'full-time',
      description: '',
      requirements: [],
      benefits: [],
      closingDate: '',
      active: true,
      sortOrder: 99,
    });
  });

  it.each([
    [{ title: '' }, 'Title is required (min 3 characters)'],
    [{ title: 'ab' }, 'Title is required (min 3 characters)'],
    [{ title: 7 }, 'Title is required (min 3 characters)'],
    [{ category: '' }, 'Category is required'],
  ])('rejects a bad create body %j', async (over, message) => {
    const res = await createListing(over as Record<string, unknown>);
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe(message);
  });

  it('lists active listings publicly, sorted by sortOrder', async () => {
    await createListing({ title: 'Second role', sortOrder: 2 });
    await createListing({ title: 'First role', sortOrder: 1 });
    const gone = (await json(await createListing({ title: 'Closed role' }))).data;
    await call('DELETE', `/careers/admin/${gone.id}`);

    const { data } = await json(await call('GET', '/careers', { auth: false }));
    expect(data.map((j: any) => j.title)).toEqual(['First role', 'Second role']);
  });

  it('the admin list includes closed listings and a total', async () => {
    const j = (await json(await createListing())).data;
    await call('DELETE', `/careers/admin/${j.id}`);
    const body = await json(await call('GET', '/careers/admin'));
    expect(body.total).toBe(1);
    expect(body.data[0].active).toBe(false);
  });

  it('updates a listing and leaves omitted fields alone', async () => {
    const j = (await json(await createListing({ description: 'original' }))).data;
    const { data } = await json(
      await call('PUT', `/careers/admin/${j.id}`, {
        body: { location: 'Cape Town', requirements: ['CFP'] },
      }),
    );
    expect(data.location).toBe('Cape Town');
    expect(data.requirements).toEqual(['CFP']);
    expect(data.description).toBe('original');
  });

  it.each([
    [{ title: '' }, 'Title is required (min 3 characters)'],
    [{ title: 'ab' }, 'Title is required (min 3 characters)'],
    [{ title: 7 }, 'Title is required (min 3 characters)'],
    [{ category: '' }, 'Category is required'],
    [{ category: 9 }, 'Category is required'],
  ])('rejects the same bad values on update that create rejects: %j', async (over, message) => {
    const j = (await json(await createListing())).data;
    const res = await call('PUT', `/careers/admin/${j.id}`, { body: over });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe(message);
    expect((kvStore.get(`job_listing:${j.id}`) as any).title).toBe('Paraplanner');
  });

  it('treats an explicit null as "leave this field alone"', async () => {
    const j = (await json(await createListing())).data;
    const { data } = await json(
      await call('PUT', `/careers/admin/${j.id}`, { body: { title: null, category: null } }),
    );
    expect(data.title).toBe('Paraplanner');
    expect(data.category).toBe('advice');
  });

  it('404s an update or delete of an unknown listing', async () => {
    expect((await call('PUT', '/careers/admin/nope', { body: {} })).status).toBe(404);
    expect((await call('DELETE', '/careers/admin/nope')).status).toBe(404);
  });

  it('soft-deletes rather than removing the row', async () => {
    const j = (await json(await createListing())).data;
    const res = await call('DELETE', `/careers/admin/${j.id}`);
    expect((await json(res)).message).toContain('Paraplanner');
    const stored = kvStore.get(`job_listing:${j.id}`) as any;
    expect(stored.active).toBe(false);
    expect(stored.deletedAt).toEqual(expect.any(String));
  });

  it('skips malformed rows rather than rendering them', async () => {
    kvStore.set('job_listing:junk', { title: 'no id' });
    await createListing();
    expect((await json(await call('GET', '/careers', { auth: false }))).data).toHaveLength(1);
  });

  it('returns an empty list rather than an error when KV fails', async () => {
    kvFailure = { on: 'getByPrefix', prefix: 'job_listing:' };
    const res = await call('GET', '/careers', { auth: false });
    expect(res.status).toBe(200);
    expect((await json(res)).data).toEqual([]);
  });
});
