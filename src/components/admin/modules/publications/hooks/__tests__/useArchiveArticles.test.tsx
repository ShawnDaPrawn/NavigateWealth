/**
 * Tests for useArchiveArticles.
 *
 * Real React Query cache, mocked API and toasts — the same harness as
 * useDeleteArticles.test.tsx, since the two share their cache plumbing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeTestQueryClient } from '@/test/utils';

const mockBulkArchive = vi.fn();
const mockArchiveArticle = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Articles: {
      bulkArchiveArticles: (...args: unknown[]) => mockBulkArchive(...args),
      archiveArticle: (...args: unknown[]) => mockArchiveArticle(...args),
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

import { useArchiveArticles } from '../useArchiveArticles';
import { publicationKeys } from '../queryKeys';

const listKey = publicationKeys.articleList(undefined);
const article = (id: string, status = 'draft') => ({ id, title: id, status });

function setup(seed = [article('d1'), article('d2'), article('p1', 'published')]) {
  const queryClient = makeTestQueryClient();
  queryClient.setQueryData(listKey, seed);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useArchiveArticles(), { wrapper });
  const statuses = () =>
    Object.fromEntries(
      (queryClient.getQueryData(listKey) as Array<{ id: string; status: string }>).map((a) => [
        a.id,
        a.status,
      ]),
    );
  return { queryClient, result, statuses };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useArchiveArticles', () => {
  it('marks the rows archived before the request finishes', async () => {
    let finish!: (value: unknown) => void;
    mockBulkArchive.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { result, statuses } = setup();

    act(() => result.current.mutate({ ids: ['d1', 'p1'], mode: 'bulk' }));

    await waitFor(() =>
      expect(statuses()).toEqual({ d1: 'archived', d2: 'draft', p1: 'archived' }),
    );
    expect(mockBulkArchive).toHaveBeenCalledWith(['d1', 'p1']);
    expect(toastMock.loading).toHaveBeenCalledWith('Archiving 2 articles…');

    await act(async () => finish({ archived: ['d1', 'p1'], notFound: [] }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toastMock.success).toHaveBeenCalledWith('Archived 2 articles', { id: 'toast-1' });
  });

  it('restores every row to its previous status when the request fails', async () => {
    mockBulkArchive.mockRejectedValue(new Error('Server temporarily unavailable'));
    const { result, statuses } = setup();

    await act(async () => {
      await result.current.mutateAsync({ ids: ['d1', 'p1'], mode: 'bulk' }).catch(() => {});
    });

    expect(statuses()).toEqual({ d1: 'draft', d2: 'draft', p1: 'published' });
    expect(toastMock.error).toHaveBeenCalledWith('Server temporarily unavailable', {
      id: 'toast-1',
    });
  });

  it('refetches the article lists once, when the archive settles', async () => {
    mockBulkArchive.mockResolvedValue({ archived: ['d1'], notFound: [] });
    const { result, queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.mutateAsync({ ids: ['d1'], mode: 'bulk' });
    });

    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: publicationKeys.articles() });
  });

  it('uses the per-article route for a single archive', async () => {
    mockArchiveArticle.mockResolvedValue(article('p1', 'archived'));
    const { result, statuses } = setup();

    await act(async () => {
      await result.current.mutateAsync({ ids: ['p1'], mode: 'single' });
    });

    expect(mockArchiveArticle).toHaveBeenCalledWith('p1');
    expect(mockBulkArchive).not.toHaveBeenCalled();
    expect(statuses().p1).toBe('archived');
    expect(toastMock.success).toHaveBeenCalledWith('Article archived successfully', {
      id: 'toast-1',
    });
  });
});
