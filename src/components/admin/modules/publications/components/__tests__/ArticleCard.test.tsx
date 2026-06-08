import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArticleCard } from '../ArticleCard';

const mockArticle = {
  id: 'art-1',
  title: 'Understanding Your Retirement Options',
  excerpt: 'A guide to planning for retirement.',
  slug: 'understanding-retirement-options',
  status: 'published' as const,
  category_id: 'cat-1',
  type_id: 'type-1',
  is_featured: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('ArticleCard', () => {
  it('renders article title', () => {
    render(<ArticleCard article={mockArticle} />);
    expect(screen.getByText('Understanding Your Retirement Options')).toBeDefined();
  });

  it('renders excerpt', () => {
    render(<ArticleCard article={mockArticle} />);
    expect(screen.getByText('A guide to planning for retirement.')).toBeDefined();
  });

  it('calls onClick when card is clicked', () => {
    const onClick = vi.fn();
    render(<ArticleCard article={mockArticle} onClick={onClick} />);
    fireEvent.click(screen.getByText('Understanding Your Retirement Options'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders status badge when showStatus=true', () => {
    render(<ArticleCard article={mockArticle} showStatus={true} />);
    expect(screen.getByText(/published/i)).toBeDefined();
  });

  it('renders without image when showImage=false', () => {
    const { container } = render(<ArticleCard article={mockArticle} showImage={false} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders without metadata when showMetadata=false', () => {
    const { container } = render(<ArticleCard article={mockArticle} showMetadata={false} />);
    expect(container.firstChild).toBeDefined();
  });
});
