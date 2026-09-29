/**
 * NewsletterDetailPage — what "Read online" opens.
 *
 * The point of this page over a bare link to the PDF is that the issue has a
 * real address: a title and description in the markup, a canonical URL, and a
 * download beside the embedded document (or, on a phone, buttons in its place).
 * A slug that does not exist must read as "not found" rather than an error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { PublicNewsletter } from '../resources/newsletterArchive';

const query = vi.hoisted(() => ({
  usePublishedNewsletter: vi.fn(),
}));
vi.mock('../resources/useNewsletters', () => query);
vi.mock('../../seo/SEO', () => ({
  SEO: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="seo" data-title={title} data-description={description} />
  ),
  createWebPageSchema: (title: string) => ({ '@type': 'WebPage', name: title }),
}));

import { NewsletterDetailPage } from '../NewsletterDetailPage';

const newsletter: PublicNewsletter = {
  slug: '2026-09-september-market-review',
  title: 'September Market Review',
  description: 'Rates, retirement annuities and the two-pot changes explained.',
  issueMonth: '2026-09',
  year: 2026,
  month: 9,
  pdfUrl: 'https://cdn.test/2026/september.pdf',
  pdfFileName: 'september.pdf',
  pdfSizeBytes: 2 * 1024 * 1024,
  publishedAt: '2026-09-30T09:00:00.000Z',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[`/resources/newsletter/${newsletter.slug}`]}>
      <Routes>
        <Route path="/resources/newsletter/:slug" element={<NewsletterDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn();
  query.usePublishedNewsletter.mockReturnValue({
    data: newsletter,
    isLoading: false,
    error: null,
  });
});

describe('NewsletterDetailPage', () => {
  it('shows the issue, its title and description, and the embedded PDF', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('September Market Review');
    expect(screen.getByText(/two-pot changes explained/)).toBeTruthy();
    expect(screen.getByText('September 2026')).toBeTruthy();

    const embed = screen.getByLabelText('September Market Review (PDF)');
    expect(embed.getAttribute('data')).toBe('https://cdn.test/2026/september.pdf');
  });

  it('puts the newsletter title and description into the page metadata', () => {
    renderPage();
    const seo = screen.getByTestId('seo');
    expect(seo.getAttribute('data-title')).toBe(
      'September Market Review | Navigate Wealth Newsletter',
    );
    expect(seo.getAttribute('data-description')).toBe(newsletter.description);
  });

  it('offers the PDF for download under its real file name', () => {
    renderPage();
    // One button for tablet and up, one in the phone layout; CSS shows one.
    const downloads = screen.getAllByRole('link', { name: /download pdf/i });
    expect(downloads).toHaveLength(2);
    for (const download of downloads) {
      expect(download.getAttribute('href')).toBe('https://cdn.test/2026/september.pdf');
      expect(download.getAttribute('download')).toBe('september.pdf');
    }
    expect(screen.getByText(/september\.pdf · 2\.0 MB/)).toBeTruthy();
  });

  it('gives phones a button to open the PDF instead of the embedded viewer', () => {
    renderPage();
    // Phone browsers cannot page through an embedded PDF, so below `sm` the
    // viewer is not rendered (and so never fetched) and the file opens in the
    // phone's own viewer instead.
    const read = screen.getByRole('link', { name: /read the newsletter/i });
    expect(read.getAttribute('href')).toBe('https://cdn.test/2026/september.pdf');
    expect(read.getAttribute('target')).toBe('_blank');
    expect(read.getAttribute('rel')).toBe('noopener noreferrer');
    expect(read.parentElement?.className).toMatch(/(^|\s)sm:hidden(\s|$)/);
    expect(screen.getByText('PDF · 2.0 MB')).toBeTruthy();

    const viewer = screen.getByLabelText('September Market Review (PDF)').parentElement;
    expect(viewer?.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(viewer?.className).toMatch(/(^|\s)sm:block(\s|$)/);
  });

  it('links back to the archive tab', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /all newsletters/i }).getAttribute('href')).toBe(
      '/resources?section=newsletters',
    );
  });

  it('reads an unknown slug as not found, not as an error', () => {
    query.usePublishedNewsletter.mockReturnValue({ data: null, isLoading: false, error: null });
    renderPage();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Newsletter not found');
    expect(screen.getByText(/moved or withdrawn/)).toBeTruthy();
  });

  it('says so when the newsletter could not be loaded at all', () => {
    query.usePublishedNewsletter.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('network'),
    });
    renderPage();
    expect(screen.getByText(/could not load this newsletter/i)).toBeTruthy();
  });

  it('shows a loading state while it fetches', () => {
    query.usePublishedNewsletter.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    renderPage();
    expect(screen.getByText(/loading newsletter/i)).toBeTruthy();
  });
});
