/**
 * The Resources page tab strip.
 *
 * Newsletters is the fourth tab and sits after Market News — the position the
 * owner asked for — and `?section=newsletters` opens it directly, which is
 * what the footer and sitemap links rely on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const publications = vi.hoisted(() => ({
  useArticles: vi.fn(() => ({ articles: [], isLoading: false })),
  useCategories: vi.fn(() => ({ categories: [], isLoading: false })),
  useMarketNews: vi.fn(() => ({ data: undefined, isLoading: false, refetch: vi.fn() })),
  InsightsTab: () => <div data-testid="insights-tab" />,
  MarketWatchTab: () => <div data-testid="market-watch-tab" />,
  MarketNewsTab: () => <div data-testid="market-news-tab" />,
  CATEGORY_ICON_MAP: {},
  formatDate: (d: string) => d,
}));
vi.mock('../../admin/modules/publications', () => publications);

const newsletters = vi.hoisted(() => ({
  usePublishedNewsletters: vi.fn(() => ({ data: [], isLoading: false })),
}));
vi.mock('../resources/useNewsletters', () => newsletters);
vi.mock('../resources/NewslettersTab', () => ({
  NewslettersTab: () => <div data-testid="newsletters-tab" />,
}));
vi.mock('../../seo/SEO', () => ({
  SEO: () => null,
  createWebPageSchema: () => ({}),
}));

import { ResourcesPage } from '../ResourcesPage';

const renderPage = (search = '') =>
  render(
    <MemoryRouter initialEntries={[`/resources${search}`]}>
      <ResourcesPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Resources page tabs', () => {
  it('lists Newsletters fourth, right after Market News', () => {
    renderPage();
    const labels = screen.getAllByRole('tab').map((t) => t.textContent?.trim());
    expect(labels).toHaveLength(4);
    expect(labels[3]).toBe('Newsletters');
    expect(labels[2]).toBe('Market News');
  });

  it('opens the Newsletters tab from ?section=newsletters', () => {
    renderPage('?section=newsletters');
    expect(screen.getByTestId('newsletters-tab')).toBeTruthy();
    const selected = screen
      .getAllByRole('tab')
      .find((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected?.textContent?.trim()).toBe('Newsletters');
  });

  it('does not fetch newsletters while another tab is open', () => {
    renderPage();
    expect(newsletters.usePublishedNewsletters).toHaveBeenCalledWith(false);
  });

  it('fetches them once the tab is the active one', () => {
    renderPage('?section=newsletters');
    expect(newsletters.usePublishedNewsletters).toHaveBeenCalledWith(true);
  });
});
