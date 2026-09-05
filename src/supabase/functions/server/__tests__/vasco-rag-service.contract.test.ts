/**
 * Contract tests for the Vasco knowledge index (`vasco-rag-service.ts`).
 *
 * The bug these guard: Knowledge Base entries were written to KV and read by
 * nothing, so an admin could "seed" Vasco all day and it never picked any of
 * it up. The index now holds both published articles and live KB entries, and
 * a KB write syncs into it immediately. Only the IO boundary is mocked — KV,
 * the logger and the OpenAI embeddings call. Embeddings are keyword-based
 * one-hot vectors so similarity is exact: a matching topic scores 1, a
 * non-matching one 0 (below the 0.3 floor).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import { kvStore } from './helpers/contract-harness.ts';

(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
  env: { get: (k: string) => (k === 'OPENAI_API_KEY' ? 'sk-test' : undefined) },
};

const {
  indexAllArticles,
  syncKnowledgeEntry,
  removeKnowledgeEntryFromIndex,
  syncArticle,
  removeArticleFromIndex,
  retrieveContext,
  getIndexStatus,
  clearArticleIndex,
  knowledgeEntryToText,
} = await import('../vasco-rag-service.ts');

// ── Embeddings stand-in ──────────────────────────────────────────────────────
const TOPICS = ['tfsa', 'retirement', 'medical', 'estate'] as const;
function embed(text: string): number[] {
  const lower = text.toLowerCase();
  const vec = TOPICS.map((t) => (lower.includes(t) ? 1 : 0));
  return vec.some(Boolean) ? vec : [0, 0, 0, 0, 1];
}

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function embeddingsWork() {
  fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
    const { input } = JSON.parse(init.body) as { input: string[] };
    return {
      ok: true,
      json: async () => ({ data: input.map((t, index) => ({ index, embedding: embed(t) })) }),
    };
  });
}

function embeddingsDown() {
  fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => 'down' });
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const LONG_BODY = '<p>' + 'A TFSA lets you save R36,000 a year tax free. '.repeat(5) + '</p>';

function article(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'art-tfsa',
    title: 'Understanding TFSA limits',
    slug: 'understanding-tfsa',
    status: 'published',
    body: LONG_BODY,
    excerpt: 'TFSA basics',
    ...overrides,
  };
}

function kbEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'kb_1',
    title: 'Retirement annuity contribution rule',
    type: 'qa' as const,
    status: 'active' as const,
    content: '',
    question: 'How much of my income can I put into a retirement annuity?',
    answer: 'Up to 27.5% of the greater of remuneration or taxable income, capped at R350,000.',
    category: 'Retirement',
    tags: ['ra'],
    agentScope: 'all' as const,
    priority: 5,
    createdBy: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Put a KB entry into KV the way kb-service does (entry + index of ids). */
function seedKbEntries(entries: ReturnType<typeof kbEntry>[]) {
  for (const e of entries) kvStore.set(`ai:kb:${e.id}`, e);
  kvStore.set('ai:kb:index', { entryIds: entries.map((e) => e.id), updatedAt: 'x' });
}

beforeEach(() => {
  kvStore.clear();
  fetchMock.mockReset();
  embeddingsWork();
});

// ============================================================================

describe('knowledge base entries reach the index', () => {
  it('a live entry is retrievable immediately after syncKnowledgeEntry', async () => {
    const result = await syncKnowledgeEntry(kbEntry());
    expect(result).toEqual({ indexed: true, chunkCount: 1 });

    // Stored under the kb: key segment so it can never collide with an article id.
    expect(kvStore.has('vasco:emb:kb:kb_1:0')).toBe(true);
    expect(kvStore.has('vasco:chunk:kb:kb_1:0')).toBe(true);

    const hits = await retrieveContext('what is the retirement annuity limit?');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      sourceType: 'kb',
      sourceId: 'kb_1',
      articleTitle: 'Retirement annuity contribution rule',
      articleSlug: '',
    });
    expect(hits[0].text).toContain('27.5%');
  });

  it('the Q&A text puts the question first so a matching question scores high', () => {
    const text = knowledgeEntryToText(kbEntry());
    expect(text.startsWith('Retirement annuity contribution rule')).toBe(true);
    expect(text).toContain('Question: How much of my income');
    expect(text).toContain('Answer: Up to 27.5%');
  });

  it('turning a live entry into a draft removes it from the index', async () => {
    await syncKnowledgeEntry(kbEntry());
    const result = await syncKnowledgeEntry(kbEntry({ status: 'draft' }));
    expect(result).toEqual({ indexed: false, chunkCount: 0 });

    expect(kvStore.has('vasco:emb:kb:kb_1:0')).toBe(false);
    expect(await retrieveContext('retirement annuity limit')).toEqual([]);
  });

  it('re-syncing an edited entry replaces its old chunks rather than stacking them', async () => {
    await syncKnowledgeEntry(kbEntry());
    await syncKnowledgeEntry(kbEntry({ answer: 'Updated answer about retirement: 27.5%.' }));

    const status = await getIndexStatus();
    expect(status.kbEntries).toHaveLength(1);
    expect(status.totalChunks).toBe(1);

    const [hit] = await retrieveContext('retirement');
    expect(hit.text).toContain('Updated answer');
  });

  it('deleting an entry drops it from the index', async () => {
    await syncKnowledgeEntry(kbEntry());
    await removeKnowledgeEntryFromIndex('kb_1');
    expect(kvStore.has('vasco:chunk:kb:kb_1:0')).toBe(false);
    expect((await getIndexStatus()).kbEntries).toEqual([]);
  });

  it('an entry scoped to one agent is invisible to the others', async () => {
    await syncKnowledgeEntry(kbEntry({ agentScope: ['vasco-authenticated'] }));

    expect(await retrieveContext('retirement', { agentId: 'vasco-public' })).toEqual([]);
    expect(await retrieveContext('retirement', { agentId: 'vasco-authenticated' })).toHaveLength(1);
    // No agent given (legacy caller) → not filtered.
    expect(await retrieveContext('retirement')).toHaveLength(1);
  });

  it('priority nudges a KB entry above an equally similar article', async () => {
    await syncArticle(
      article({
        id: 'art-ra',
        slug: 'ra',
        title: 'Retirement annuities',
        body: '<p>' + 'Retirement annuity basics. '.repeat(6) + '</p>',
      }),
    );
    await syncKnowledgeEntry(kbEntry({ priority: 10 }));

    const hits = await retrieveContext('retirement');
    expect(hits.map((h) => h.sourceType)).toEqual(['kb', 'article']);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it('propagates an embedding failure so the route can report it (the entry itself is kept by the caller)', async () => {
    embeddingsDown();
    await expect(syncKnowledgeEntry(kbEntry())).rejects.toThrow(/Embedding generation failed/);
  });
});

// ============================================================================

describe('articles follow publication state', () => {
  it('a published article is indexed and cited by slug', async () => {
    const result = await syncArticle(article());
    expect(result.indexed).toBe(true);

    const [hit] = await retrieveContext('tfsa');
    expect(hit).toMatchObject({ sourceType: 'article', articleSlug: 'understanding-tfsa' });
  });

  it('an unpublished article is removed', async () => {
    await syncArticle(article());
    await syncArticle(article({ status: 'draft' }));
    expect(await retrieveContext('tfsa')).toEqual([]);
    expect((await getIndexStatus()).articles).toEqual([]);
  });

  it('a body that is too short is not indexed', async () => {
    const result = await syncArticle(article({ body: '<p>short</p>' }));
    expect(result).toEqual({ indexed: false, chunkCount: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('removeArticleFromIndex is a no-op for an article that was never indexed', async () => {
    await expect(removeArticleFromIndex('nope')).resolves.toBeUndefined();
  });
});

// ============================================================================

describe('full rebuild', () => {
  it('indexes every published article AND every live KB entry, skipping drafts of both', async () => {
    kvStore.set('article:art-tfsa', article());
    kvStore.set('article:art-draft', article({ id: 'art-draft', status: 'draft' }));
    seedKbEntries([
      kbEntry(),
      kbEntry({ id: 'kb_draft', status: 'draft', question: 'medical aid?', answer: 'medical' }),
    ]);

    const result = await indexAllArticles();
    expect(result).toMatchObject({ articlesIndexed: 1, kbEntriesIndexed: 1, errors: [] });
    expect(result.totalChunks).toBe(2);

    expect((await retrieveContext('tfsa'))[0].sourceType).toBe('article');
    expect((await retrieveContext('retirement'))[0].sourceType).toBe('kb');
    expect(await retrieveContext('medical')).toEqual([]);
  });

  it('a rebuild clears stale chunks written by an earlier incremental sync', async () => {
    await syncKnowledgeEntry(kbEntry());
    // The entry has since been archived directly in KV (no sync ran).
    seedKbEntries([kbEntry({ status: 'archived' })]);

    await indexAllArticles();
    expect(kvStore.has('vasco:emb:kb:kb_1:0')).toBe(false);
    expect(await retrieveContext('retirement')).toEqual([]);
  });

  it('one bad source does not abort the rebuild', async () => {
    kvStore.set('article:ok', article({ id: 'ok', slug: 'ok' }));
    seedKbEntries([kbEntry()]);
    let calls = 0;
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      calls++;
      if (calls === 1) return { ok: false, status: 500, text: async () => 'boom' };
      const { input } = JSON.parse(init.body) as { input: string[] };
      return {
        ok: true,
        json: async () => ({ data: input.map((t, index) => ({ index, embedding: embed(t) })) }),
      };
    });

    const result = await indexAllArticles();
    expect(result.articlesIndexed).toBe(0);
    expect(result.kbEntriesIndexed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Understanding TFSA limits');
  });

  it('clearArticleIndex removes everything', async () => {
    kvStore.set('article:art-tfsa', article());
    seedKbEntries([kbEntry()]);
    await indexAllArticles();
    await clearArticleIndex();

    expect([...kvStore.keys()].filter((k) => k.startsWith('vasco:'))).toEqual([]);
    expect(await retrieveContext('tfsa')).toEqual([]);
  });
});

// ============================================================================

describe('index status for the admin UI', () => {
  it('reports nothing indexed when no index exists', async () => {
    const status = await getIndexStatus();
    expect(status).toMatchObject({
      indexed: false,
      articles: [],
      kbEntries: [],
      totalChunks: 0,
      lastFullIndex: null,
      lastUpdated: null,
      pendingArticles: 0,
      pendingKbEntries: 0,
      staleSources: 0,
    });
  });

  it('counts published articles and live entries that are not in the index yet', async () => {
    kvStore.set('article:art-tfsa', article());
    kvStore.set('article:art-2', article({ id: 'art-2', slug: 'two' }));
    seedKbEntries([
      kbEntry(),
      kbEntry({ id: 'kb_2' }),
      kbEntry({ id: 'kb_draft', status: 'draft' }),
    ]);
    await syncKnowledgeEntry(kbEntry());

    const status = await getIndexStatus();
    expect(status).toMatchObject({
      indexed: true,
      publishedArticleCount: 2,
      activeKbCount: 2,
      pendingArticles: 2,
      pendingKbEntries: 1,
      staleSources: 0,
      lastFullIndex: null,
    });
    expect(status.lastUpdated).toBeTruthy();
  });

  it('counts indexed sources that are no longer published or live as stale', async () => {
    kvStore.set('article:art-tfsa', article());
    seedKbEntries([kbEntry()]);
    await indexAllArticles();

    kvStore.set('article:art-tfsa', article({ status: 'draft' }));
    seedKbEntries([kbEntry({ status: 'archived' })]);

    const status = await getIndexStatus();
    expect(status.staleSources).toBe(2);
    expect(status.publishedArticleCount).toBe(0);
    expect(status.activeKbCount).toBe(0);
    expect(status.lastFullIndex).toBeTruthy();
  });
});

describe('retrieval edge cases', () => {
  it('returns nothing (and never calls the embeddings API) when there is no index', async () => {
    expect(await retrieveContext('anything')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns nothing rather than throwing when the embeddings API is down', async () => {
    await syncKnowledgeEntry(kbEntry());
    embeddingsDown();
    expect(await retrieveContext('retirement')).toEqual([]);
  });
});
