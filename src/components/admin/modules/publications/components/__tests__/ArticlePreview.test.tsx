import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('dompurify', () => ({
  default: { sanitize: (s: string) => s },
}));
vi.mock('../../../../figma/ImageWithFallback', () => ({
  ImageWithFallback: ({ alt }: { alt: string }) => <img alt={alt} />,
}));
vi.mock('../utils', () => ({
  getArticleImageUrl: () => null,
  getRelativeTime: () => '1 hour ago',
  truncateText: (s: string) => s,
}));

import { ArticlePreview } from '../ArticlePreview';

const mockArticle = {
  title: 'Test Article Title',
  subtitle: 'A subtitle',
  slug: 'test-article',
  excerpt: 'Short excerpt here.',
  content: '<p>Article content</p>',
  category_id: 'cat-1',
  type_id: 'type-1',
  status: 'published',
  is_featured: false,
  author_name: 'Jane Doe',
};

const mockCategories = [{ id: 'cat-1', name: 'Finance', slug: 'finance', description: '' }];
const mockTypes = [{ id: 'type-1', name: 'Article', slug: 'article' }];

describe('ArticlePreview', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <ArticlePreview
        article={mockArticle}
        categories={mockCategories}
        types={mockTypes}
        onClose={() => {}}
      />,
    );
    expect(container.firstChild).toBeDefined();
  });

  it('renders article title', () => {
    render(
      <ArticlePreview
        article={mockArticle}
        categories={mockCategories}
        types={mockTypes}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Test Article Title')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <ArticlePreview
        article={mockArticle}
        categories={mockCategories}
        types={mockTypes}
        onClose={() => {}}
      />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
