/**
 * The redesigned newsletter link forwarder, reached the way production
 * reaches it: NewsletterClickThroughPage with the design switch on lazy-loads
 * NavigatorNewsletterClickThroughPage. Covers what the redesign must not lose:
 * the SEO tags, the click recorded exactly as the live page records it (once,
 * even under StrictMode), the redirect going only to the URL the server
 * returns — never to anything in the address bar — and the live wording of
 * every state.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../utils/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/api/client')>()),
  api,
}));

const { NewsletterClickThroughPage } =
  await import('../../components/pages/NewsletterClickThroughPage');
const { NEWSLETTER_CLICK_SEO } = await import('../../components/pages/newsletterStatusData');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8');
/** The live page, whitespace collapsed so JSX line breaks do not matter. */
const liveSource = read('../../components/pages/NewsletterClickThroughPage.tsx').replace(
  /\s+/g,
  ' ',
);

const LINK = '?c=camp-1&t=tok-9&l=link-3';
const PDF = 'https://proj.supabase.co/storage/v1/object/sign/newsletters/issue.pdf?token=abc';

const originalLocation = window.location;
const replace = vi.fn();

async function renderPage(search = LINK) {
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/newsletter/click${search}`]}>
        <Routes>
          <Route path="/newsletter/click" element={<NewsletterClickThroughPage />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );
  return screen.findByRole('heading', { level: 1 });
}

async function heading(text: string) {
  const h1 = await screen.findByRole('heading', { level: 1, name: text });
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  return h1;
}

beforeEach(() => {
  api.post.mockReset();
  replace.mockReset();
  Object.defineProperty(window, 'location', {
    value: Object.assign(new URL('https://www.navigatewealth.co/newsletter/click'), {
      replace,
      assign: vi.fn(),
      reload: vi.fn(),
    }),
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', { value: originalLocation, configurable: true });
});

describe('Navigator newsletter click-through page', () => {
  it("shows the board's frame and the live page's words while it works, with one H1", async () => {
    api.post.mockReturnValue(new Promise(() => {}));
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Taking you to your link…');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(liveSource).toContain('Taking you to your link…');
    expect(screen.getByText('Newsletter link')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Navigate Wealth home' }).getAttribute('href')).toBe(
      '/',
    );
    expect(screen.getByRole('link', { name: 'Legal' }).getAttribute('href')).toBe('/legal');
  });

  it('emits the same SEO tags as the live page, kept out of search', async () => {
    api.post.mockReturnValue(new Promise(() => {}));
    await renderPage();
    await waitFor(() => expect(document.title).toBe(NEWSLETTER_CLICK_SEO.title));
    expect(document.title).toBe('Redirecting | Navigate Wealth');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://www.navigatewealth.co/newsletter/click',
    );
    expect(liveSource).toContain('NEWSLETTER_CLICK_SEO as seoProps');
  });

  it('records the click once, exactly as live, and goes to the URL the server returns', async () => {
    api.post.mockResolvedValue({ success: true, url: PDF });
    await renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith(PDF));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith('newsletter-studio/track/click', {
      campaignId: 'camp-1',
      token: 'tok-9',
      linkId: 'link-3',
    });
    expect(liveSource).toContain(
      "api.post<{ url: string }>('newsletter-studio/track/click', { campaignId, token, linkId, });",
    );

    await heading('Taking you to your link…');
    expect(screen.getByText('If you are not redirected automatically:')).toBeTruthy();
    const manual = screen.getByRole('link', { name: 'Continue to link' });
    expect(manual.getAttribute('href')).toBe(PDF);
    expect(manual.getAttribute('rel')).toBe('noopener noreferrer');
    expect(liveSource).toContain('<a href={destination} rel="noopener noreferrer">');
  });

  it('never takes a destination from the address bar', async () => {
    api.post.mockResolvedValue({ success: true, url: PDF });
    await renderPage(`${LINK}&url=https%3A%2F%2Fevil.example&redirect=https%3A%2F%2Fevil.example`);
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace.mock.calls).toEqual([[PDF]]);
    expect(document.body.innerHTML).not.toContain('evil.example');
  });

  it('shows "no longer available" for an answer without a URL, and does not redirect', async () => {
    api.post.mockResolvedValue({ success: true });
    await renderPage();
    await heading('This link is no longer available');
    expect(screen.getByText('The newsletter link may have expired or been removed.')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows "no longer available" for a refusal', async () => {
    api.post.mockRejectedValue(new Error('Not found'));
    await renderPage();
    await heading('This link is no longer available');
    expect(replace).not.toHaveBeenCalled();
  });

  it('turns down a link missing any of its ids, without a request', async () => {
    for (const search of ['?c=camp-1&t=tok-9', '?t=tok-9&l=link-3', '?c=camp-1&l=link-3', '']) {
      await renderPage(search);
      await heading('This link is no longer available');
      cleanup();
    }
    expect(api.post).not.toHaveBeenCalled();
  });

  it("offers the board's two ways on, both to routes the site serves", async () => {
    await renderPage('');
    await heading('This link is no longer available');
    expect(screen.getByRole('link', { name: 'Go to Navigate Wealth' }).getAttribute('href')).toBe(
      '/',
    );
    expect(screen.getByRole('link', { name: 'Browse past newsletters' }).getAttribute('href')).toBe(
      '/resources?section=newsletters',
    );
    for (const text of [
      'This link is no longer available',
      'The newsletter link may have expired or been removed.',
      'If you are not redirected automatically:',
      'Continue to link',
      'Go to Navigate Wealth',
    ]) {
      expect(liveSource).toContain(text);
    }
  });
});
