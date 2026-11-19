/**
 * The redesigned newsletter issue page, reached the way production reaches it:
 * NewsletterDetailPage with the design switch on lazy-loads
 * NavigatorNewsletterIssuePage. Covers what the redesign must not lose (one
 * H1, the live SEO tags and JSON-LD, the same data routes, the live PDF embed
 * with its fallback, the download and open links, the phone buttons, the way
 * back to the archive, "not found" for an unknown slug and noindex with it,
 * the loading and failure states) and what it adds (the previous issue from
 * the archive, and the newsletter sign-up on the footer's endpoint and
 * payload). The file name and size are shown only as far as the record has
 * them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../utils/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/api/client')>()),
  api,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const { NewsletterDetailPage } = await import('../../components/pages/NewsletterDetailPage');
const { APIError } = await import('../../utils/api/client');
const { siteAbsoluteUrl } = await import('../../utils/siteOrigin');

const OCTOBER = {
  slug: '2026-10-navigate-wealth-october-2026-the-wealth-compass-make-room',
  title: 'Navigate Wealth | October 2026 | The Wealth Compass: Make room for 2027',
  description:
    'The October issue connects rising household costs with investment and currency risk.',
  issueMonth: '2026-10',
  year: 2026,
  month: 10,
  pdfUrl: 'https://cdn.test/newsletters/2026/october.pdf',
  pdfFileName: 'Navigate_Wealth_Newsletter_2026-10.pdf',
  pdfSizeBytes: 1888630,
  publishedAt: '2026-10-10T09:44:07.072Z',
};
const SEPTEMBER = {
  ...OCTOBER,
  slug: '2026-09-navigate-wealth-september-2026-the-wealth-compass-protect',
  title: 'Navigate Wealth | September 2026 | The Wealth Compass: Protect what matters',
  description: 'The September issue.',
  issueMonth: '2026-09',
  month: 9,
  pdfUrl: 'https://cdn.test/newsletters/2026/september.pdf',
  pdfFileName: 'Navigate_Wealth_Newsletter_2026-09.pdf',
  publishedAt: '2026-09-17T09:56:05.003Z',
};
const AUGUST = {
  ...SEPTEMBER,
  slug: '2026-08-navigate-wealth-august-2026',
  title: 'Navigate Wealth | August 2026 | Mid-year check-in',
  issueMonth: '2026-08',
  month: 8,
  publishedAt: '2026-08-12T09:00:00.000Z',
};
const ARCHIVE = [OCTOBER, SEPTEMBER, AUGUST];

type Issue = typeof OCTOBER;

/** The public newsletter route, as newsletterApi.ts reads it through the client. */
function stubRoutes(issues: Issue[] = ARCHIVE) {
  api.get.mockImplementation(async (path: string) => {
    if (path === '/newsletter-site/newsletters') return { newsletters: issues };
    const slug = decodeURIComponent(path.replace('/newsletter-site/newsletters/', ''));
    const issue = issues.find((n) => n.slug === slug);
    if (!issue) throw new APIError('Newsletter not found', 404);
    return { newsletter: issue };
  });
}

function renderPage(slug = OCTOBER.slug) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/resources/newsletter/${slug}`]}>
        <Routes>
          <Route path="/resources/newsletter/:slug" element={<NewsletterDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function renderLoaded(slug = OCTOBER.slug) {
  renderPage(slug);
  return screen.findByRole('heading', { level: 1 });
}

const meta = (name: string) =>
  document.querySelector(`meta[name="${name}"]`)?.getAttribute('content');

beforeEach(() => {
  vi.clearAllMocks();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  stubRoutes();
});
afterEach(() => {
  cleanup();
  document.getElementById('seo-structured-data')?.remove();
  document.querySelector('link[rel="canonical"]')?.remove();
});

describe('Navigator newsletter issue page', () => {
  it('has one H1: the issue’s headline, with the full title as its byline', async () => {
    const h1 = await renderLoaded();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h1.closest('.nw-site.nwni')).not.toBeNull();
    expect(h1.textContent).toBe('The Wealth Compass: Make room for 2027');
    expect(h1.querySelector('.nwni-accent-l')?.textContent).toBe('Make room for 2027');
    expect(screen.getByText(OCTOBER.title)).toBeDefined();
    expect(screen.getByText(OCTOBER.description)).toBeDefined();
    expect(screen.getByText('October 2026').className).toContain('nwni-issue');
    expect(screen.getByText('Navigate Wealth newsletter')).toBeDefined();
  });

  it('emits the live page’s SEO tags and JSON-LD', async () => {
    await renderLoaded();
    const seoTitle = `${OCTOBER.title} | Navigate Wealth Newsletter`;
    const canonical = siteAbsoluteUrl(`/resources/newsletter/${OCTOBER.slug}`);
    await waitFor(() => expect(document.title).toBe(seoTitle));
    expect(meta('description')).toBe(OCTOBER.description);
    expect(meta('robots')).toBe('index, follow');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical);
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data).toMatchObject({
      '@type': 'WebPage',
      name: seoTitle,
      description: OCTOBER.description,
      url: canonical,
    });
  });

  it('reads the live page’s route, then the archive for the previous issue, and scrolls to the top', async () => {
    await renderLoaded();
    expect(api.get).toHaveBeenCalledWith(`/newsletter-site/newsletters/${OCTOBER.slug}`);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/newsletter-site/newsletters'));
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it('embeds the real PDF in the reader, with the live fallback inside it', async () => {
    await renderLoaded();
    const reader = screen.getByRole('region', { name: 'Newsletter reader' });
    // Hidden on phones by CSS, as the live viewer is, so a phone never fetches it.
    expect(reader.className).toContain('nwni-only-lg');
    const embed = within(reader).getByLabelText(`${OCTOBER.title} (PDF)`);
    expect(embed.tagName).toBe('OBJECT');
    expect(embed.getAttribute('type')).toBe('application/pdf');
    expect(embed.getAttribute('data')).toBe(`${OCTOBER.pdfUrl}#toolbar=0&navpanes=0&view=FitH`);
    expect(within(embed).getByText('Your browser cannot display the PDF here.')).toBeDefined();
    const fallback = within(embed).getByRole('link', { name: 'Open the PDF in a new tab' });
    expect(fallback.getAttribute('href')).toBe(OCTOBER.pdfUrl);
    expect(fallback.getAttribute('target')).toBe('_blank');
    expect(fallback.getAttribute('rel')).toBe('noopener noreferrer');
    expect(
      within(reader).getByText('Navigate_Wealth_Newsletter_2026-10.pdf · 1.8 MB'),
    ).toBeDefined();
  });

  it('zooms the page from 70% to 150% in steps of ten, as the board does', async () => {
    await renderLoaded();
    const reader = screen.getByRole('region', { name: 'Newsletter reader' });
    const page = reader.querySelector<HTMLElement>('.nwni-page')!;
    const zoomIn = within(reader).getByRole('button', { name: 'Zoom in' });
    const zoomOut = within(reader).getByRole('button', { name: 'Zoom out' });
    expect(within(reader).getByText('100%')).toBeDefined();
    expect(page.style.width).toBe('540px');

    fireEvent.click(zoomIn);
    expect(within(reader).getByText('110%')).toBeDefined();
    expect(page.style.width).toBe('594px');

    for (let i = 0; i < 8; i++) fireEvent.click(zoomIn);
    expect(within(reader).getByText('150%')).toBeDefined();
    expect(page.style.width).toBe('810px');
    expect(zoomIn.getAttribute('aria-disabled')).toBe('true');

    for (let i = 0; i < 12; i++) fireEvent.click(zoomOut);
    expect(within(reader).getByText('70%')).toBeDefined();
    expect(page.style.width).toBe('378px');
    expect(zoomOut.getAttribute('aria-disabled')).toBe('true');
    expect(zoomIn.getAttribute('aria-disabled')).toBeNull();
  });

  it('offers the PDF for download under its real file name, and opens it in a new tab', async () => {
    await renderLoaded();
    const downloads = screen.getAllByRole('link', { name: 'Download PDF' });
    // The masthead button, the phone button and the reader's toolbar icon.
    expect(downloads).toHaveLength(3);
    for (const link of downloads) {
      expect(link.getAttribute('href')).toBe(OCTOBER.pdfUrl);
      expect(link.getAttribute('download')).toBe(OCTOBER.pdfFileName);
    }
    const open = screen
      .getAllByRole('link', { name: 'Open the PDF in a new tab' })
      .find((link) => link.className.includes('nwni-tool'))!;
    expect(open.getAttribute('href')).toBe(OCTOBER.pdfUrl);
    expect(open.getAttribute('target')).toBe('_blank');
    expect(open.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('gives phones buttons in place of the reader', async () => {
    await renderLoaded();
    const read = screen.getByRole('link', { name: 'Read the newsletter' });
    expect(read.getAttribute('href')).toBe(OCTOBER.pdfUrl);
    expect(read.getAttribute('target')).toBe('_blank');
    expect(read.getAttribute('rel')).toBe('noopener noreferrer');
    const phone = read.parentElement!;
    expect(phone.className).toContain('nwni-only-sm');
    expect(
      within(phone).getByText('Navigate_Wealth_Newsletter_2026-10.pdf · 1.8 MB'),
    ).toBeDefined();
    // The masthead's own download button is the desktop one.
    const side = screen
      .getAllByRole('link', { name: 'Download PDF' })
      .find((link) => link.closest('.nwni-mast'))!;
    expect(side.parentElement?.className).toContain('nwni-only-lg');
  });

  it('shows only the file facts the record has', async () => {
    stubRoutes([{ ...OCTOBER, pdfSizeBytes: 0 }, SEPTEMBER]);
    await renderLoaded();
    expect(screen.getAllByText('Navigate_Wealth_Newsletter_2026-10.pdf')).toHaveLength(2);
    cleanup();

    stubRoutes([{ ...OCTOBER, pdfSizeBytes: 0, pdfFileName: '' }, SEPTEMBER]);
    await renderLoaded();
    expect(document.querySelector('.nwni-phone-file')).toBeNull();
    expect(screen.queryByText(/\.pdf/)).toBeNull();
  });

  it('leaves the byline out and sets no italic when the title is only a headline', async () => {
    stubRoutes([{ ...OCTOBER, title: 'Year-end planning' }]);
    const h1 = await renderLoaded();
    expect(h1.textContent).toBe('Year-end planning');
    expect(h1.querySelector('.nwni-accent-l')).toBeNull();
    expect(document.querySelector('.nwni-byline')).toBeNull();
  });

  it('links back to the archive, to the previous issue and on to advice', async () => {
    await renderLoaded();
    expect(screen.getByRole('link', { name: 'All newsletters' }).getAttribute('href')).toBe(
      '/resources?section=newsletters',
    );
    const previous = await screen.findByRole('link', { name: /Previous issue/ });
    expect(previous.getAttribute('href')).toBe(`/resources/newsletter/${SEPTEMBER.slug}`);
    expect(within(previous).getByText('Previous issue · September 2026')).toBeDefined();
    expect(previous.querySelector('.nwni-prev-t')?.textContent).toBe(
      'The Wealth Compass: Protect what matters',
    );
    expect(
      screen.getByRole('link', { name: 'Book a Free Consultation' }).getAttribute('href'),
    ).toBe('/schedule-consultation');
    expect(screen.getByRole('link', { name: 'Ask Vasco' }).getAttribute('href')).toBe('/ask-vasco');
    expect(screen.getByText(/Talk to a qualified adviser/)).toBeDefined();
  });

  it('has no previous issue for the first one', async () => {
    await renderLoaded(AUGUST.slug);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/newsletter-site/newsletters'));
    expect(screen.queryByText(/Previous issue/)).toBeNull();
    expect(screen.getByText('Stay')).toBeDefined();
  });

  it.each([
    [{ requiresConfirmation: true }, 'Check your email!', /confirmation link/],
    [{ alreadySubscribed: true }, 'Already subscribed', /already on our mailing list/],
    [{}, 'Successfully subscribed!', /Thank you for subscribing/],
  ])(
    'subscribes on the footer’s endpoint and payload and answers in place (%o)',
    async (reply, title, text) => {
      api.post.mockResolvedValue({ success: true, ...reply });
      await renderLoaded();
      fireEvent.change(screen.getByLabelText('Email address'), {
        target: { value: 'reader@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
      const status = await screen.findByRole('status');
      expect(api.post).toHaveBeenCalledWith(
        '/newsletter/subscribe',
        { email: 'reader@example.com' },
        { retryTransientFailures: false },
      );
      expect(within(status).getByText(title)).toBeDefined();
      expect(status.textContent).toMatch(text);
      expect(screen.queryByLabelText('Email address')).toBeNull();
      expect(toast.error).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['', 'Please enter your email address'],
    ['not-an-email', 'Please enter a valid email address'],
  ])('rejects %j with the live message, marks the field and focuses it', async (value, message) => {
    await renderLoaded();
    const input = screen.getByLabelText('Email address');
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(toast.error).toHaveBeenCalledWith(message);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'reader@example.com' } });
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('pretends to subscribe a bot that fills the hidden field', async () => {
    await renderLoaded();
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'spam.example' } });
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'bot@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(api.post).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says so when the subscription fails, and keeps the form', async () => {
    api.post.mockRejectedValue(new Error('Service unavailable'));
    await renderLoaded();
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Subscription failed', {
        description: 'Service unavailable',
      }),
    );
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDefined();
  });

  it('reads an unknown slug as not found, with noindex', async () => {
    const h1 = await renderLoaded('no-such-issue');
    expect(h1.textContent).toBe('Newsletter not found');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/moved or withdrawn/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Back to all newsletters' }).getAttribute('href')).toBe(
      '/resources?section=newsletters',
    );
    await waitFor(() => expect(document.title).toBe('Newsletter not found | Navigate Wealth'));
    expect(meta('robots')).toBe('noindex, follow');
    expect(meta('description')).toBe('This newsletter is no longer available.');
    // No archive call for a page with no issue.
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('says so when the newsletter could not be loaded at all', async () => {
    api.get.mockRejectedValue(new Error('network'));
    const h1 = await renderLoaded();
    expect(h1.textContent).toBe('Newsletter not found');
    expect(screen.getByText(/could not load this newsletter/i)).toBeDefined();
  });

  it('shows a loading state while it fetches', async () => {
    api.get.mockImplementation(() => new Promise(() => {}));
    renderPage();
    const status = await screen.findByRole('status');
    expect(status.textContent).toBe('Loading newsletter…');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});
