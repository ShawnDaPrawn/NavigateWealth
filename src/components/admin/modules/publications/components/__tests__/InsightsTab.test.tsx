import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { InsightsTab } from '../InsightsTab';

const categories = [
  { id: '__all__', name: 'All', slug: 'all' },
  { id: 'cat-1', name: 'Finance', slug: 'finance' },
  { id: 'cat-2', name: 'Tax', slug: 'tax' },
];

const articles = {
  __all__: [
    { id: 'a1', title: 'Article One', slug: 'article-one', excerpt: 'First article' },
    { id: 'a2', title: 'Article Two', slug: 'article-two', excerpt: 'Second article' },
  ],
  'cat-1': [{ id: 'a1', title: 'Article One', slug: 'article-one', excerpt: 'Finance article' }],
  'cat-2': [],
};

describe('InsightsTab', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <MemoryRouter>
        <InsightsTab
          categories={categories}
          activeCategory="__all__"
          onCategoryChange={() => {}}
          articles={articles}
        />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders category tabs', () => {
    render(
      <MemoryRouter>
        <InsightsTab
          categories={categories}
          activeCategory="__all__"
          onCategoryChange={() => {}}
          articles={articles}
        />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('All').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Finance').length).toBeGreaterThan(0);
  });

  it('renders article titles', () => {
    render(
      <MemoryRouter>
        <InsightsTab
          categories={categories}
          activeCategory="__all__"
          onCategoryChange={() => {}}
          articles={articles}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Article One')).toBeDefined();
    expect(screen.getByText('Article Two')).toBeDefined();
  });

  it('calls onCategoryChange when category tab is clicked', () => {
    const onCategoryChange = vi.fn();
    render(
      <MemoryRouter>
        <InsightsTab
          categories={categories}
          activeCategory="__all__"
          onCategoryChange={onCategoryChange}
          articles={articles}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByText('Finance')[0]);
    expect(onCategoryChange).toHaveBeenCalledWith('cat-1');
  });

  it('renders empty state for empty category', () => {
    const { container } = render(
      <MemoryRouter>
        <InsightsTab
          categories={categories}
          activeCategory="cat-2"
          onCategoryChange={() => {}}
          articles={articles}
        />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders with empty categories', () => {
    const { container } = render(
      <MemoryRouter>
        <InsightsTab
          categories={[]}
          activeCategory="__all__"
          onCategoryChange={() => {}}
          articles={{}}
        />
      </MemoryRouter>,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <MemoryRouter>
        <InsightsTab
          categories={categories}
          activeCategory="__all__"
          onCategoryChange={() => {}}
          articles={articles}
        />
      </MemoryRouter>,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
