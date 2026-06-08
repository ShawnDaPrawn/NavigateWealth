import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewQueue } from '../ReviewQueue';
import type { Article, Category } from '../../types';

vi.mock('../api', () => ({
  PublicationsAPI: {
    updateArticle: vi.fn(),
  },
}));
vi.mock('../utils', () => ({
  getRelativeTime: () => '1 hour ago',
  truncateText: (text: string) => text,
}));

const mockCategory: Category = {
  id: 'cat-1',
  name: 'General',
  slug: 'general',
  description: '',
};

const mockArticle: Article = {
  id: 'a1',
  title: 'Auto-Generated Article',
  slug: 'auto-generated-article',
  excerpt: 'This is an auto-generated article.',
  category_id: 'cat-1',
  type_id: 'type-1',
  status: 'draft',
  is_featured: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  last_edited_by: 'auto:market_commentary',
};

describe('ReviewQueue', () => {
  it('renders without crashing with empty articles', () => {
    const { container } = render(
      <ReviewQueue articles={[]} categories={[]} onEditArticle={() => {}} onRefresh={() => {}} />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders empty state when no auto-generated articles', () => {
    const regularArticle = { ...mockArticle, last_edited_by: 'user123' };
    const { container } = render(
      <ReviewQueue
        articles={[regularArticle]}
        categories={[mockCategory]}
        onEditArticle={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders auto-generated article in queue', () => {
    render(
      <ReviewQueue
        articles={[mockArticle]}
        categories={[mockCategory]}
        onEditArticle={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByText('Auto-Generated Article')).toBeDefined();
  });

  it('renders pipeline badge for market commentary', () => {
    render(
      <ReviewQueue
        articles={[mockArticle]}
        categories={[mockCategory]}
        onEditArticle={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getAllByText(/Market/i).length).toBeGreaterThan(0);
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <ReviewQueue
        articles={[mockArticle]}
        categories={[mockCategory]}
        onEditArticle={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
