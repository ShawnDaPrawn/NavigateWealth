/**
 * Tests for useDeleteArticles.
 *
 * Runs the real React Query cache so the optimistic removal, the restore of
 * kept / failed rows, and the single settle-time refetch are all observed the
 * way the Articles list sees them. Only the API and the toasts are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeTestQueryClient } from '@/test/utils';

const mockBulkDelete = vi.fn();
const mockDeleteArticle = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Articles: {
      bulkDeleteArticles: (...args: unknown[]) => mockBulkDelete(...args),
      deleteArticle: (...args: unknown[]) => mockDeleteArticle(...args),
    },
  },
}));

const toastMock = vi.hoisted(() => ({
  loading: vi.fn(() => 'toast-1'),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: toastMock }));

import { useDeleteArticles } from '../useDeleteArticles';
import { publicationKeys } from '../queryKeys';

const listKey = publicationKeys.articleList(undefined);
const article = (id: string, status = 'draft') => ({ id, title: id, status });

function setup(seed = [article('d1'), article('d2'), article('p1', 'published')]) {
  const queryClient = makeTestQueryClient();
  queryClient.setQueryData(listKey, seed);
  // A list with no observer is never refetched by invalidation, so the
  // assertions below see the cache the mutation left behind.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useDeleteArticles(), { wrapper });
  const ids = () => (queryClient.getQueryData(listKey) as Array<{ id: string }>).map((a) => a.id);
  return { queryClient, result, ids };
}

/** A promise the test resolves by hand, to look at the cache mid-request. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDeleteArticles', () => {
  it('removes the rows from the list before the request finishes', async () => {
    const pending = deferred<unknown>();
    mockBulkDelete.mockReturnValue(pending.promise);
    const { result, ids } = setup();

    act(() => result.current.mutate({ ids: ['d1', 'd2'], mode: 'bulk' }));

    await waitFor(() => expect(ids()).toEqual(['p1']));
    expect(mockBulkDelete).toHaveBeenCalledWith(['d1', 'd2']);
    expect(toastMock.loading).toHaveBeenCalledWith('Deleting 2 articles…');

    await act(async () => pending.resolve({ deleted: ['d1', 'd2'], kept: [], notFound: [] }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ids()).toEqual(['p1']);
    expect(toastMock.success).toHaveBeenCalledWith('Deleted 2 articles', { id: 'toast-1' });
  });

  it('puts back an article the server kept, and says why', async () => {
    mockBulkDelete.mockResolvedValue({ deleted: ['d1'], kept: ['d2'], notFound: [] });
    const { result, ids } = setup();

    await act(async () => {
      await result.current.mutateAsync({ ids: ['d1', 'd2'], mode: 'bulk' });
    });

    expect(ids().sort()).toEqual(['d2', 'p1']);
    expect(toastMock.info).toHaveBeenCalledWith(expect.stringMatching(/^Kept 1 published article/));
  });

  it('treats an id the server no longer had as deleted', async () => {
    mockBulkDelete.mockResolvedValue({ deleted: ['d1'], kept: [], notFound: ['d2'] });
    const { result, ids } = setup();

    await act(async () => {
      await result.current.mutateAsync({ ids: ['d1', 'd2'], mode: 'bulk' });
    });

    expect(ids()).toEqual(['p1']);
    expect(toastMock.success).toHaveBeenCalledWith('Deleted 2 articles', { id: 'toast-1' });
  });

  it('restores every row and reports the error when the request fails', async () => {
    mockBulkDelete.mockRejectedValue(new Error('Server temporarily unavailable'));
    const { result, ids } = setup();

    await act(async () => {
      await result.current.mutateAsync({ ids: ['d1', 'd2'], mode: 'bulk' }).catch(() => {});
    });

    expect(ids().sort()).toEqual(['d1', 'd2', 'p1']);
    expect(toastMock.error).toHaveBeenCalledWith('Server temporarily unavailable', {
      id: 'toast-1',
    });
  });

  it('refetches the article lists once, when the delete settles', async () => {
    mockBulkDelete.mockResolvedValue({ deleted: ['d1'], kept: [], notFound: [] });
    const { result, queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync({ ids: ['d1'], mode: 'bulk' });
    });

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: publicationKeys.articles() });
  });

  it('uses the per-article DELETE for a single delete, which may remove a published article', async () => {
    mockDeleteArticle.mockResolvedValue(undefined);
    const { result, ids } = setup();

    await act(async () => {
      await result.current.mutateAsync({ ids: ['p1'], mode: 'single' });
    });

    expect(mockDeleteArticle).toHaveBeenCalledWith('p1');
    expect(mockBulkDelete).not.toHaveBeenCalled();
    expect(ids()).toEqual(['d1', 'd2']);
  });

  it('leaves a cached single article untouched by the list filter, then drops it once deleted', async () => {
    mockBulkDelete.mockResolvedValue({ deleted: ['d1'], kept: [], notFound: [] });
    const { result, queryClient } = setup();
    queryClient.setQueryData(publicationKeys.article('d1'), article('d1'));

    await act(async () => {
      await result.current.mutateAsync({ ids: ['d1'], mode: 'bulk' });
    });

    expect(queryClient.getQueryData(publicationKeys.article('d1'))).toBeUndefined();
  });
});
