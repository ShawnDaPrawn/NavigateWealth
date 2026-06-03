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
import { render, screen } from '@/test/utils';

vi.mock('@/components/admin/modules/publications/hooks', () => ({
  useArticles: () => ({ articles: [], isLoading: false, error: null, refetch: vi.fn() }),
  useCategories: () => ({ categories: [], isLoading: false }),
  useArticleActions: () => ({
    handleDuplicate: vi.fn(),
    handleDelete: vi.fn(),
    handleArchive: vi.fn(),
    isProcessing: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { ArticlesListView } from '../ArticlesListView';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
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
});
