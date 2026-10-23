/**
 * Reviews are only shown when a reader can trace them.
 *
 * A directory listing was declined in October 2026 partly because the site's
 * testimonials had no source or date. This pins the two halves of the fix:
 * an empty list renders nothing (no "What Our Clients Say" shell with nothing
 * in it), and every review that does render links to its original with the
 * platform and posting date in view.
 *
 * Run: npx vitest run src/components/shared/__tests__/PublishedReviews.test.tsx
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublishedReviews } from '../PublishedReviews';
import { PUBLISHED_REVIEWS, type PublishedReview } from '@/config/publishedReviews';

const review: PublishedReview = {
  quote: 'Clear, honest advice and a plan we actually understand.',
  author: 'Jane Example',
  platform: 'Google',
  url: 'https://example.com/reviews/jane',
  postedOn: '2026-10-01',
  rating: 5,
};

describe('PublishedReviews', () => {
  it('renders nothing when there are no reviews', () => {
    const { container } = render(<PublishedReviews reviews={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('links each review to its source with the platform and posting date', () => {
    render(<PublishedReviews reviews={[review]} />);

    expect(screen.getByText(/Clear, honest advice/)).toBeDefined();
    expect(screen.getByText('Jane Example')).toBeDefined();

    const link = screen.getByRole('link', { name: /Google review · 0?1 Oct 2026/ });
    expect(link.getAttribute('href')).toBe(review.url);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(screen.getByLabelText('5 out of 5 stars')).toBeDefined();
  });

  it('omits the star row when the platform gives no rating', () => {
    render(<PublishedReviews reviews={[{ ...review, rating: undefined }]} />);
    expect(screen.queryByLabelText(/out of 5 stars/)).toBeNull();
  });

  it('only ships reviews that carry a source link and a posting date', () => {
    for (const entry of PUBLISHED_REVIEWS) {
      expect(entry.url, entry.author).toMatch(/^https:\/\//);
      expect(entry.postedOn, entry.author).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.platform.trim(), entry.author).not.toBe('');
    }
  });
});
