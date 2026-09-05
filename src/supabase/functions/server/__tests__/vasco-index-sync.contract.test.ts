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

const { syncArticleIndexInBackground, removeArticleFromIndexInBackground } =
  await import('../vasco-index-sync.ts');

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
});
