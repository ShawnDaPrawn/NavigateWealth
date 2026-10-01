/**
 * ArticlesListView — Render / Characterization Test (Phase 4)
 * ============================================================
 *
 * Locks the loading-state gate and the always-visible chrome (stat pills,
 * toolbar) for this 880-line Phase 6 decomposition target.
 *
 * Publications hooks are mocked so no React Query context is required.
 * With isLoading=false and articles=[] the component renders the full UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { toast } from 'sonner';

const mocks = vi.hoisted(() => ({
  articles: [] as Array<Record<string, unknown>>,
  deleteArticles: vi.fn(),
  archiveArticles: vi.fn(),
}));

vi.mock('@/components/admin/modules/publications/hooks', () => ({
  useArticles: () => ({
    articles: mocks.articles,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCategories: () => ({ categories: [], isLoading: false }),
  useArticleActions: () => ({
    handleDuplicate: vi.fn(),
    isProcessing: false,
  }),
  useDeleteArticles: () => ({ mutate: mocks.deleteArticles, isPending: false }),
  useArchiveArticles: () => ({ mutate: mocks.archiveArticles, isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const article = (id: string, status: string) => ({
  id,
  title: `Article ${id}`,
  status,
  category_id: 'c1',
  is_featured: false,
  view_count: 0,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
});

/** Tick the header checkbox, which selects every row in view. */
function selectAll(container: HTMLElement) {
  fireEvent.click(container.querySelector('thead button')!);
}

function clickBulkDelete() {
  fireEvent.click(screen.getByText('Delete').closest('button')!);
}

function clickBulkArchive() {
  fireEvent.click(screen.getByText('Archive').closest('button')!);
}

import { ArticlesListView } from '../ArticlesListView';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.articles = [];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ArticlesListView', () => {
  it('renders without throwing', () => {
    const { container } = render(<ArticlesListView onCreateNew={noop} onEditArticle={noop} />);
    expect(container).toBeTruthy();
  });

  it('shows the Create First Article empty-state button when no articles exist', () => {
    render(<ArticlesListView onCreateNew={noop} onEditArticle={noop} />);
    expect(screen.getByRole('button', { name: /create first article/i })).toBeTruthy();
  });

  it('shows the Search input', () => {
    render(<ArticlesListView onCreateNew={noop} onEditArticle={noop} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
  });

  describe('bulk delete', () => {
    it('deletes the selected drafts and leaves published articles out', () => {
      mocks.articles = [article('d1', 'draft'), article('p1', 'published'), article('d2', 'draft')];
      const { container } = render(<ArticlesListView onCreateNew={noop} onEditArticle={noop} />);

      selectAll(container);
      clickBulkDelete();
      expect(
        screen.getByText(/1 published article\(s\) in your selection will be kept/),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(mocks.deleteArticles).toHaveBeenCalledTimes(1);
      const [vars] = mocks.deleteArticles.mock.calls[0];
      expect(vars.mode).toBe('bulk');
      expect([...vars.ids].sort()).toEqual(['d1', 'd2']);
    });

    it('clears the selection as soon as the delete is confirmed', () => {
      mocks.articles = [article('d1', 'draft')];
      const { container } = render(<ArticlesListView onCreateNew={noop} onEditArticle={noop} />);

      selectAll(container);
      expect(screen.getByText('1 selected')).toBeTruthy();
      clickBulkDelete();
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(screen.queryByText('1 selected')).toBeNull();
    });

    it('refuses a selection of only published articles without opening the dialog', () => {
      mocks.articles = [article('p1', 'published'), article('p2', 'published')];
      const { container } = render(<ArticlesListView onCreateNew={noop} onEditArticle={noop} />);

      selectAll(container);
      clickBulkDelete();

      expect(mocks.deleteArticles).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringMatching(/Published articles cannot be bulk deleted/),
      );
    });
  });

  describe('bulk archive', () => {
    it('archives the selection in one call and warns that published ones go offline', () => {
      mocks.articles = [article('d1', 'draft'), article('p1', 'published')];
      const { container } = render(<ArticlesListView onCreateNew={noop} onEditArticle={noop} />);

      selectAll(container);
      clickBulkArchive();
      expect(
        screen.getByText(/1 of them are published and will be taken off the live site/),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(mocks.archiveArticles).toHaveBeenCalledTimes(1);
      const [vars] = mocks.archiveArticles.mock.calls[0];
      expect(vars.mode).toBe('bulk');
      expect([...vars.ids].sort()).toEqual(['d1', 'p1']);
      expect(screen.queryByText('2 selected')).toBeNull();
    });

    it('leaves already archived articles out of the request', () => {
      mocks.articles = [article('d1', 'draft'), article('a1', 'archived')];
      const { container } = render(<ArticlesListView onCreateNew={noop} onEditArticle={noop} />);

      selectAll(container);
      clickBulkArchive();
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(mocks.archiveArticles.mock.calls[0][0].ids).toEqual(['d1']);
    });

    it('says so, without a dialog, when everything selected is already archived', () => {
      mocks.articles = [article('a1', 'archived')];
      const { container } = render(<ArticlesListView onCreateNew={noop} onEditArticle={noop} />);

      selectAll(container);
      clickBulkArchive();

      expect(mocks.archiveArticles).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(toast.info).toHaveBeenCalledWith('The selected articles are already archived.');
    });
  });
});
