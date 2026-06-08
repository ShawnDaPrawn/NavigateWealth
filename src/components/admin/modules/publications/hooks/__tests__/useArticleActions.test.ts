/**
 * Tests for useArticleActions hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArticleActions } from '../useArticleActions';
import type { Article, ArticlePublishResponse } from '../../types';

// ---------------------------------------------------------------------------
// Mock factories (declared before vi.mock so hoisting can reference them)
// ---------------------------------------------------------------------------
const mockCreateArticle = vi.fn();
const mockUpdateArticle = vi.fn();
const mockPublishArticle = vi.fn();
const mockUnpublishArticle = vi.fn();
const mockDeleteArticle = vi.fn();
const mockArchiveArticle = vi.fn();
const mockGetArticle = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Articles: {
      createArticle: (...args: unknown[]) => mockCreateArticle(...args),
      updateArticle: (...args: unknown[]) => mockUpdateArticle(...args),
      publishArticle: (...args: unknown[]) => mockPublishArticle(...args),
      unpublishArticle: (...args: unknown[]) => mockUnpublishArticle(...args),
      deleteArticle: (...args: unknown[]) => mockDeleteArticle(...args),
      archiveArticle: (...args: unknown[]) => mockArchiveArticle(...args),
      getArticle: (...args: unknown[]) => mockGetArticle(...args),
    },
  },
}));

vi.mock('../../constants', () => ({
  SUCCESS_MESSAGES: {
    articleCreated: 'Article created successfully',
    articleUpdated: 'Article updated successfully',
    articleDeleted: 'Article deleted successfully',
    articlePublished: 'Article published successfully',
    articleUnpublished: 'Article unpublished successfully',
    articleScheduled: 'Article scheduled successfully',
    articleDuplicated: 'Article duplicated successfully',
  },
  ERROR_MESSAGES: {
    articleCreateFailed: 'Failed to create article',
    articleUpdateFailed: 'Failed to update article',
    articleDeleteFailed: 'Failed to delete article',
    articlePublishFailed: 'Failed to publish article',
    articleUnpublishFailed: 'Failed to unpublish article',
    articleScheduleFailed: 'Failed to schedule article',
    articleDuplicateFailed: 'Failed to duplicate article',
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'art-1',
    title: 'Test Article',
    slug: 'test-article',
    excerpt: 'Test excerpt',
    body: 'Test body content',
    category_id: 'cat-1',
    type_id: 'type-1',
    status: 'draft',
    is_featured: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePublishResponse(article: Article): ArticlePublishResponse {
  return { article, notificationJob: null };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useArticleActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it('initial isProcessing is false', () => {
    const { result } = renderHook(() => useArticleActions());
    expect(result.current.isProcessing).toBe(false);
  });

  // ── handleCreate ──────────────────────────────────────────────────────────

  it('handleCreate returns article and calls onSuccess on success', async () => {
    const article = makeArticle();
    mockCreateArticle.mockResolvedValueOnce(article);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onSuccess }));

    let returned: Article | null = null;
    await act(async () => {
      returned = await result.current.handleCreate({
        title: 'Test',
        excerpt: 'ex',
        category_id: 'cat-1',
        type_id: 'type-1',
      });
    });

    expect(returned).toEqual(article);
    expect(onSuccess).toHaveBeenCalledWith('Article created successfully', article);
    expect(result.current.isProcessing).toBe(false);
  });

  it('handleCreate returns null and calls onError on failure', async () => {
    mockCreateArticle.mockRejectedValueOnce(new Error('Network error'));
    const onError = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onError }));

    let returned: Article | null | undefined;
    await act(async () => {
      returned = await result.current.handleCreate({
        title: 'Test',
        excerpt: 'ex',
        category_id: 'cat-1',
        type_id: 'type-1',
      });
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Network error');
    expect(result.current.isProcessing).toBe(false);
  });

  it('handleCreate uses fallback error message when error is not an Error instance', async () => {
    mockCreateArticle.mockRejectedValueOnce('some string error');
    const onError = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onError }));
    await act(async () => {
      await result.current.handleCreate({
        title: 'Test',
        excerpt: 'ex',
        category_id: 'cat-1',
        type_id: 'type-1',
      });
    });

    expect(onError).toHaveBeenCalledWith('Failed to create article');
  });

  // ── handleUpdate ──────────────────────────────────────────────────────────

  it('handleUpdate returns article and calls onSuccess on success', async () => {
    const article = makeArticle({ title: 'Updated' });
    mockUpdateArticle.mockResolvedValueOnce(article);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onSuccess }));

    let returned: Article | null = null;
    await act(async () => {
      returned = await result.current.handleUpdate('art-1', { id: 'art-1', title: 'Updated' });
    });

    expect(returned).toEqual(article);
    expect(onSuccess).toHaveBeenCalledWith('Article updated successfully', article);
  });

  it('handleUpdate returns null and calls onError on failure', async () => {
    mockUpdateArticle.mockRejectedValueOnce(new Error('Update failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onError }));

    let returned: Article | null | undefined;
    await act(async () => {
      returned = await result.current.handleUpdate('art-1', { id: 'art-1', title: 'Updated' });
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Update failed');
  });

  // ── handlePublish ─────────────────────────────────────────────────────────

  it('handlePublish returns publish response and calls onSuccess on success', async () => {
    const article = makeArticle({ status: 'published' });
    const publishResponse = makePublishResponse(article);
    mockPublishArticle.mockResolvedValueOnce(publishResponse);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onSuccess }));

    let returned: ArticlePublishResponse | null = null;
    await act(async () => {
      returned = await result.current.handlePublish('art-1', true);
    });

    expect(returned).toEqual(publishResponse);
    expect(onSuccess).toHaveBeenCalledWith('Article published successfully', article);
  });

  it('handlePublish returns null and calls onError on failure', async () => {
    mockPublishArticle.mockRejectedValueOnce(new Error('Publish failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onError }));

    let returned: ArticlePublishResponse | null | undefined;
    await act(async () => {
      returned = await result.current.handlePublish('art-1');
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Publish failed');
  });

  // ── handleUnpublish ───────────────────────────────────────────────────────

  it('handleUnpublish returns article and calls onSuccess on success', async () => {
    const article = makeArticle({ status: 'draft' });
    mockUnpublishArticle.mockResolvedValueOnce(article);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onSuccess }));

    let returned: Article | null = null;
    await act(async () => {
      returned = await result.current.handleUnpublish('art-1');
    });

    expect(returned).toEqual(article);
    expect(onSuccess).toHaveBeenCalledWith('Article unpublished successfully', article);
  });

  it('handleUnpublish returns null and calls onError on failure', async () => {
    mockUnpublishArticle.mockRejectedValueOnce(new Error('Unpublish failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onError }));

    let returned: Article | null | undefined;
    await act(async () => {
      returned = await result.current.handleUnpublish('art-1');
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Unpublish failed');
  });

  // ── handleSchedule ────────────────────────────────────────────────────────

  it('handleSchedule returns article and calls onSuccess on success', async () => {
    const article = makeArticle({ status: 'scheduled' });
    mockUpdateArticle.mockResolvedValueOnce(article);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onSuccess }));

    let returned: Article | null = null;
    await act(async () => {
      returned = await result.current.handleSchedule('art-1', '2026-12-01T10:00:00Z', true);
    });

    expect(returned).toEqual(article);
    expect(onSuccess).toHaveBeenCalledWith('Article scheduled successfully', article);
    expect(mockUpdateArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'art-1',
        status: 'scheduled',
        scheduled_for: '2026-12-01T10:00:00Z',
      }),
    );
  });

  it('handleSchedule returns null and calls onError on failure', async () => {
    mockUpdateArticle.mockRejectedValueOnce(new Error('Schedule failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onError }));

    let returned: Article | null | undefined;
    await act(async () => {
      returned = await result.current.handleSchedule('art-1', '2026-12-01T10:00:00Z');
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Schedule failed');
  });

  // ── handleDelete ──────────────────────────────────────────────────────────

  it('handleDelete returns true and calls onSuccess and onDelete on success', async () => {
    mockDeleteArticle.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();
    const onDelete = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onSuccess, onDelete }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleDelete('art-1');
    });

    expect(returned).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith('Article deleted successfully');
    expect(onDelete).toHaveBeenCalled();
  });

  it('handleDelete returns false and calls onError on failure', async () => {
    mockDeleteArticle.mockRejectedValueOnce(new Error('Delete failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onError }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleDelete('art-1');
    });

    expect(returned).toBe(false);
    expect(onError).toHaveBeenCalledWith('Delete failed');
  });

  // ── handleArchive ─────────────────────────────────────────────────────────

  it('handleArchive returns article and calls onSuccess on success', async () => {
    const article = makeArticle({ status: 'archived' });
    mockArchiveArticle.mockResolvedValueOnce(article);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onSuccess }));

    let returned: Article | null = null;
    await act(async () => {
      returned = await result.current.handleArchive('art-1');
    });

    expect(returned).toEqual(article);
    expect(onSuccess).toHaveBeenCalledWith('Article archived successfully', article);
  });

  it('handleArchive returns null and calls onError on failure', async () => {
    mockArchiveArticle.mockRejectedValueOnce(new Error('Archive failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onError }));

    let returned: Article | null | undefined;
    await act(async () => {
      returned = await result.current.handleArchive('art-1');
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Archive failed');
  });

  // ── handleDuplicate ───────────────────────────────────────────────────────

  it('handleDuplicate fetches original, creates a copy, and calls onSuccess', async () => {
    const original = makeArticle({ title: 'Original', slug: 'original' });
    const duplicate = makeArticle({
      id: 'art-2',
      title: 'Original (Copy)',
      slug: expect.stringContaining('original-copy') as string,
    });
    mockGetArticle.mockResolvedValueOnce(original);
    mockCreateArticle.mockResolvedValueOnce(duplicate);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onSuccess }));

    let returned: Article | null = null;
    await act(async () => {
      returned = await result.current.handleDuplicate('art-1');
    });

    expect(mockGetArticle).toHaveBeenCalledWith('art-1');
    expect(mockCreateArticle).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Original (Copy)', status: 'draft', is_featured: false }),
    );
    expect(returned).toEqual(duplicate);
    expect(onSuccess).toHaveBeenCalledWith('Article duplicated successfully', duplicate);
  });

  it('handleDuplicate returns null and calls onError on failure', async () => {
    mockGetArticle.mockRejectedValueOnce(new Error('Not found'));
    const onError = vi.fn();

    const { result } = renderHook(() => useArticleActions({ onError }));

    let returned: Article | null | undefined;
    await act(async () => {
      returned = await result.current.handleDuplicate('art-1');
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Not found');
  });

  // ── isProcessing during async operations ─────────────────────────────────

  it('isProcessing is true while an async operation is in flight', async () => {
    let resolveCreate!: (value: Article) => void;
    const pendingPromise = new Promise<Article>((res) => {
      resolveCreate = res;
    });
    mockCreateArticle.mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() => useArticleActions());

    // Start the async operation without awaiting
    let actionPromise: Promise<Article | null>;
    act(() => {
      actionPromise = result.current.handleCreate({
        title: 'T',
        excerpt: 'e',
        category_id: 'c',
        type_id: 't',
      });
    });

    // isProcessing should be true while pending
    expect(result.current.isProcessing).toBe(true);

    // Now resolve and wait for it
    await act(async () => {
      resolveCreate(makeArticle());
      await actionPromise!;
    });

    expect(result.current.isProcessing).toBe(false);
  });

  // ── Callbacks not required ────────────────────────────────────────────────

  it('works without any callback options provided', async () => {
    const article = makeArticle();
    mockCreateArticle.mockResolvedValueOnce(article);

    const { result } = renderHook(() => useArticleActions());

    let returned: Article | null = null;
    await act(async () => {
      returned = await result.current.handleCreate({
        title: 'Test',
        excerpt: 'ex',
        category_id: 'cat-1',
        type_id: 'type-1',
      });
    });

    expect(returned).toEqual(article);
  });
});
