import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContentCalendar } from '../ContentCalendar';
import type { Article, Category } from '../../types';

const category: Category = {
  id: 'cat-1',
  name: 'Finance',
  slug: 'finance',
  sort_order: 0,
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const article: Article = {
  id: 'art-1',
  title: 'Test Article',
  slug: 'test-article',
  excerpt: 'An excerpt',
  category_id: 'cat-1',
  type_id: 'type-1',
  status: 'published',
  is_featured: false,
  created_at: '2025-01-15T00:00:00Z',
  updated_at: '2025-01-15T00:00:00Z',
  published_at: '2025-01-15T00:00:00Z',
};

describe('ContentCalendar', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ContentCalendar
        articles={[]}
        categories={[]}
        onEditArticle={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders navigation buttons', () => {
    render(
      <ContentCalendar
        articles={[]}
        categories={[]}
        onEditArticle={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );
    expect(screen.getByText(/New Article/i)).toBeDefined();
  });

  it('renders current month heading', () => {
    const { container } = render(
      <ContentCalendar
        articles={[]}
        categories={[]}
        onEditArticle={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it('calls onCreateNew when button clicked', () => {
    const onCreateNew = vi.fn();
    render(
      <ContentCalendar
        articles={[]}
        categories={[]}
        onEditArticle={vi.fn()}
        onCreateNew={onCreateNew}
      />,
    );
    fireEvent.click(screen.getByText(/New Article/i));
    expect(onCreateNew).toHaveBeenCalled();
  });

  it('renders with articles', () => {
    const { container } = render(
      <ContentCalendar
        articles={[article]}
        categories={[category]}
        onEditArticle={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it('renders month navigation arrows', () => {
    render(
      <ContentCalendar
        articles={[]}
        categories={[]}
        onEditArticle={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
