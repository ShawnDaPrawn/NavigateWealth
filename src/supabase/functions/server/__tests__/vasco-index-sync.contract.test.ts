/**
 * `vasco-index-sync.ts` keeps article index updates alive past the response.
 *
 * On the Supabase edge runtime an un-awaited promise can be cancelled the
 * moment the response goes out, so the work must be handed to
 * `EdgeRuntime.waitUntil`. Without that hook the returned promise IS the
 * work, so a caller that awaits it gets the old synchronous behaviour.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const rag = vi.hoisted(() => ({
  syncArticle: vi.fn(),
  removeArticleFromIndex: vi.fn(),
}));
vi.mock('../vasco-rag-service.ts', () => rag);

const {
  syncArticleIndexInBackground,
  removeArticleFromIndexInBackground,
  removeArticlesFromIndexInBackground,
} = await import('../vasco-index-sync.ts');

const article = {
  id: 'a1',
  title: 'T',
  slug: 't',
  status: 'published',
  body: 'x'.repeat(200),
};

type Runtime = { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } };
const g = globalThis as Runtime;

beforeEach(() => {
  rag.syncArticle.mockReset();
  rag.removeArticleFromIndex.mockReset();
  delete g.EdgeRuntime;
});
afterEach(() => {
  delete g.EdgeRuntime;
});

describe('without an edge runtime (tests, plain Deno)', () => {
  it('the returned promise is the work itself, so awaiting it means the sync ran', async () => {
    let finished = false;
    rag.syncArticle.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      finished = true;
      return { indexed: true, chunkCount: 1 };
    });

    await syncArticleIndexInBackground(article, 'test');
    expect(finished).toBe(true);
    expect(rag.syncArticle).toHaveBeenCalledWith(article);
  });

  it('never rejects, even when the sync throws', async () => {
    rag.syncArticle.mockRejectedValue(new Error('embedding down'));
    await expect(syncArticleIndexInBackground(article, 'test')).resolves.toBeUndefined();

    rag.removeArticleFromIndex.mockRejectedValue(new Error('kv down'));
    await expect(removeArticleFromIndexInBackground('a1', 'test')).resolves.toBeUndefined();
  });
});

describe('with the Supabase edge runtime', () => {
  it('registers the work with EdgeRuntime.waitUntil and returns immediately', async () => {
    const waitUntil = vi.fn();
    g.EdgeRuntime = { waitUntil };

    let resolveSync: (v: { indexed: boolean; chunkCount: number }) => void = () => {};
    rag.syncArticle.mockImplementation(
      () => new Promise<{ indexed: boolean; chunkCount: number }>((r) => (resolveSync = r)),
    );

    // Resolves before the sync itself has finished — the runtime owns it now.
    await syncArticleIndexInBackground(article, 'test');
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(rag.syncArticle).toHaveBeenCalledWith(article);

    // The promise handed to the runtime settles (never rejects) once the sync does.
    resolveSync({ indexed: true, chunkCount: 2 });
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });

  it('does the same for removals', async () => {
    const waitUntil = vi.fn();
    g.EdgeRuntime = { waitUntil };
    rag.removeArticleFromIndex.mockResolvedValue(undefined);

    await removeArticleFromIndexInBackground('a1', 'test');
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(rag.removeArticleFromIndex).toHaveBeenCalledWith('a1');
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });

  it('registers one waitUntil for a whole batch, and starts the next removal only after the previous one settles', async () => {
    // Each removal read-modify-writes the shared index document. Running them
    // together would drop updates, so a bulk delete must stay one task and
    // one article at a time. The response still returns before that task ends.
    const waitUntil = vi.fn();
    g.EdgeRuntime = { waitUntil };
    const releases: Array<() => void> = [];
    rag.removeArticleFromIndex.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releases.push(resolve);
        }),
    );

    await removeArticlesFromIndexInBackground(['a', 'b'], 'article_bulk_deleted');

    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(rag.removeArticleFromIndex).toHaveBeenCalledTimes(1);
    expect(rag.removeArticleFromIndex).toHaveBeenCalledWith('a');

    releases[0]();
    await vi.waitFor(() => expect(rag.removeArticleFromIndex).toHaveBeenCalledTimes(2));
    expect(rag.removeArticleFromIndex).toHaveBeenNthCalledWith(2, 'b');

    releases[1]();
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });
});

describe('removeArticlesFromIndexInBackground', () => {
  it('does nothing for an empty list, and does not register a background task', async () => {
    const waitUntil = vi.fn();
    g.EdgeRuntime = { waitUntil };

    await removeArticlesFromIndexInBackground([], 'article_bulk_deleted');

    expect(rag.removeArticleFromIndex).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it('keeps going after one removal fails, and never runs two at once', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const finished: string[] = [];
    rag.removeArticleFromIndex.mockImplementation(async (id: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      finished.push(id);
      if (id === 'b') throw new Error('index write lost');
    });

    await expect(
      removeArticlesFromIndexInBackground(['a', 'b', 'c'], 'article_bulk_deleted'),
    ).resolves.toBeUndefined();

    expect(finished).toEqual(['a', 'b', 'c']);
    expect(maxInFlight).toBe(1);
  });
});
