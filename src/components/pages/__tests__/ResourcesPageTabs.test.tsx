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
    // Both the mobile block and the desktop tab render it now.
    expect(screen.getAllByTestId('newsletters-tab').length).toBeGreaterThan(0);
    const selected = screen
      .getAllByRole('tab')
      .find((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected?.textContent?.trim()).toBe('Newsletters');
  });

  it('renders the archive on a phone when the deep link asks for it (review finding)', () => {
    // Mobile deliberately has no tab strip, but the footer and sitemap point
    // straight at ?section=newsletters — that link must not land on Insights.
    renderPage('?section=newsletters');
    const mobile = document.querySelector('.sm\\:hidden.mt-5');
    expect(mobile).toBeTruthy();
    expect(mobile!.querySelector('[data-testid="newsletters-tab"]')).toBeTruthy();
  });

  it('still shows Insights on a phone for every other section', () => {
    renderPage();
    const mobile = document.querySelector('.sm\\:hidden.mt-5');
    expect(mobile!.querySelector('[data-testid="insights-tab"]')).toBeTruthy();
    expect(mobile!.querySelector('[data-testid="newsletters-tab"]')).toBeNull();
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
