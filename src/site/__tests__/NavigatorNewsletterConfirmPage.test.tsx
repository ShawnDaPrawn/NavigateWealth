/**
 * The redesigned newsletter confirmation page, reached the way production
 * reaches it: NewsletterConfirmPage with the design switch on lazy-loads
 * NavigatorNewsletterConfirmPage. Covers what the redesign must not lose (the
 * SEO tags, the confirm request exactly as the live page makes it, every state
 * and its live wording, links only to routes that exist) and what it adds
 * (the sign-up in place under an expired link, "Try again" where a retry can
 * help, a few featured articles after a confirmation).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const { NewsletterConfirmPage } = await import('../../components/pages/NewsletterConfirmPage');
const { APIError } = await import('../../utils/api/client');
const { NEWSLETTER_CONFIRM_SEO } = await import('../../components/pages/newsletterStatusData');
const { COMPANY } = await import('../../config/companyFacts');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8');
/** The live page, whitespace collapsed so JSX line breaks do not matter. */
const liveSource = read('../../components/pages/NewsletterConfirmPage.tsx').replace(/\s+/g, ' ');
const footerSource = read('../layout/NavigatorFooter.tsx').replace(/\s+/g, ' ');
const pageSource = read('../pages/NavigatorNewsletterConfirmPage.tsx');

const LINK = '?token=tok-123&email=Thandi%40Example.com';

const ARTICLES = [
  {
    id: 'a1',
    title: 'The will you signed may not be valid',
    slug: 'will-validity',
    category_name: 'Estate & Tax Planning',
    view_count: 30,
  },
  {
    id: 'a2',
    title: 'Medical scheme increases for 2027',
    slug: 'medical-2027',
    category_name: 'Risk & Insurance',
    view_count: 20,
  },
  {
    id: 'a3',
    title: 'Your household inflation rate',
    slug: 'household-inflation',
    category_name: 'Personal Finance',
    view_count: 10,
  },
  { id: 'a4', title: 'A fourth article', slug: 'fourth', view_count: 5 },
];

function stubArticles(articles: unknown[] = ARTICLES) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ data: articles }) })),
  );
}

async function renderPage(search = LINK) {
  render(
    <MemoryRouter initialEntries={[`/newsletter/confirm${search}`]}>
      <Routes>
        <Route path="/newsletter/confirm" element={<NewsletterConfirmPage />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

/** Waits for the state's heading and checks it is the page's only H1. */
async function heading(text: string) {
  const h1 = await screen.findByRole('heading', { level: 1, name: text });
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  return h1;
}

function refusal(status: number, body: unknown) {
  const error = (body as { error?: string }).error ?? `${status}`;
  return new APIError(error, status, undefined, body);
}

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  stubArticles();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Navigator newsletter confirmation page', () => {
  it("shows the board's frame and the live page's waiting state with one H1", async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Confirming Your Subscription');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Please wait while we process your confirmation...')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Navigate Wealth home' }).getAttribute('href')).toBe(
      '/',
    );
    expect(screen.getByText('Newsletter')).toBeTruthy();
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toContain(
      `${COMPANY.legalName} t/a ${COMPANY.tradingName} · FSP ${COMPANY.fspNumber}`,
    );
    expect(within(footer).getByRole('link', { name: 'Legal' }).getAttribute('href')).toBe('/legal');
    expect(screen.getByRole('link', { name: COMPANY.email }).getAttribute('href')).toBe(
      `mailto:${COMPANY.email}`,
    );
  });

  it('emits the same SEO tags as the live page, kept out of search', async () => {
    api.get.mockReturnValue(new Promise(() => {}));
    await renderPage();
    await waitFor(() => expect(document.title).toBe(NEWSLETTER_CONFIRM_SEO.title));
    expect(document.title).toBe('Newsletter Confirmation | Navigate Wealth');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://www.navigatewealth.co/newsletter/confirm',
    );
    expect(liveSource).toContain('NEWSLETTER_CONFIRM_SEO as seoProps');
  });

  it('confirms through the public route exactly as the live page does, once', async () => {
    api.get.mockResolvedValue({ success: true });
    await renderPage();
    await heading("You're In!");
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith(
      '/newsletter/confirm?token=tok-123&email=Thandi%40Example.com',
      { retryTransientFailures: false },
    );
    // The live page builds the same address…
    expect(liveSource).toContain(
      'newsletter/confirm?token=${token}&email=${encodeURIComponent(email)}',
    );
    // …but the redesign sends no anon key as a bearer token.
    expect(pageSource).not.toContain('publicAnonKey');
  });

  it("confirms with the live page's words, links and the featured articles", async () => {
    api.get.mockResolvedValue({ success: true });
    await renderPage();
    await heading("You're In!");
    const message =
      "Thank you for confirming your subscription! You'll now receive our newsletter with financial insights and updates.";
    expect(screen.getByText(message)).toBeTruthy();
    expect(liveSource).toContain(message);
    expect(screen.getByRole('link', { name: 'Explore Resources' }).getAttribute('href')).toBe(
      '/resources',
    );
    expect(screen.getByRole('link', { name: 'Return to Homepage' }).getAttribute('href')).toBe('/');

    const list = await screen.findByRole('list', { name: 'Start reading' });
    const links = within(list).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/resources/article/will-validity',
      '/resources/article/medical-2027',
      '/resources/article/household-inflation',
    ]);
    expect(links[0].textContent).toBe('Estate & Tax PlanningThe will you signed may not be valid');
    // Through the featured-articles hook the home page uses.
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
      '/publications/articles?status=published&is_featured=true',
    );
  });

  it('leaves "Start reading" out when there are no featured articles', async () => {
    stubArticles([]);
    api.get.mockResolvedValue({ success: true });
    await renderPage();
    await heading("You're In!");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText('Start reading')).toBeNull();
  });

  it('says so when the subscription was already confirmed', async () => {
    api.get.mockResolvedValue({ message: 'Already confirmed', alreadyConfirmed: true });
    await renderPage();
    await heading('Already Confirmed');
    expect(
      screen.getByText("Your subscription was already confirmed. You're all set!"),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Explore Resources' })).toBeTruthy();
    expect(screen.queryByText('Start reading')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('turns down a link without a token or an address, without a request', async () => {
    for (const search of ['?email=a%40b.co', '?token=tok-123', '']) {
      await renderPage(search);
      await heading('Confirmation Failed');
      expect(
        screen.getByText(
          'Invalid confirmation link. Please check your email for the correct link.',
        ),
      ).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Return to Homepage' }).getAttribute('href')).toBe(
        '/',
      );
      cleanup();
    }
    expect(api.get).not.toHaveBeenCalled();
  });

  it('offers the sign-up in place under an expired link, as the footer subscribes', async () => {
    api.get.mockRejectedValue(refusal(400, { error: 'Confirmation link expired' }));
    api.post.mockResolvedValue({ requiresConfirmation: true });
    await renderPage();
    await heading('Confirmation Failed');
    expect(
      screen.getByText(
        'This confirmation link has expired. Please subscribe again to receive a new confirmation email.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();

    const input = screen.getByLabelText('Subscribe again') as HTMLInputElement;
    expect(input.value).toBe('Thandi@Example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Check your email!');
    expect(status.textContent).toContain(
      "We've sent you a confirmation link. Please click it to complete your subscription.",
    );
    expect(api.post).toHaveBeenCalledWith(
      '/newsletter/subscribe',
      { email: 'Thandi@Example.com' },
      { retryTransientFailures: false },
    );
    // The footer's call, word for word.
    expect(footerSource).toContain(
      "'/newsletter/subscribe', { email }, { retryTransientFailures: false },",
    );
  });

  it('checks the address as the footer does, on the field, focusing it', async () => {
    api.get.mockRejectedValue(refusal(400, { error: 'Confirmation link expired' }));
    await renderPage();
    await heading('Confirmation Failed');
    const input = screen.getByLabelText('Subscribe again') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(screen.getByText('Please enter your email address')).toBeTruthy();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'not-an-address' } });
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(screen.getByText('Please enter a valid email address')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
    for (const text of ['Please enter your email address', 'Please enter a valid email address']) {
      expect(footerSource).toContain(text);
    }
  });

  it('shows a sign-up the server turns down in the form', async () => {
    api.get.mockRejectedValue(refusal(400, { error: 'Confirmation link expired' }));
    api.post.mockRejectedValue(new Error('Too many requests'));
    await renderPage();
    await heading('Confirmation Failed');
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Subscription failed Too many requests');
  });

  it("shows the server's own refusal, with no retry for a link it turned down", async () => {
    api.get.mockRejectedValue(refusal(404, { error: 'Subscription not found' }));
    await renderPage();
    await heading('Confirmation Failed');
    expect(screen.getByText('Subscription not found')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByLabelText('Subscribe again')).toBeNull();
  });

  it('offers "Try again" after a server fault, repeating the same request', async () => {
    api.get
      .mockRejectedValueOnce(
        refusal(500, { error: 'Failed to confirm subscription', details: 'boom' }),
      )
      .mockResolvedValueOnce({ success: true });
    await renderPage();
    await heading('Confirmation Failed');
    expect(screen.getByText('Failed to confirm subscription')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await heading("You're In!");
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get.mock.calls[1]).toEqual(api.get.mock.calls[0]);
  });

  it("uses the live page's fallback words when no answer came back", async () => {
    api.get.mockRejectedValue(
      new APIError('Network error. Please check your connection.', 0, 'NETWORK_ERROR'),
    );
    await renderPage();
    await heading('Confirmation Failed');
    const message = 'An error occurred while confirming your subscription. Please try again later.';
    expect(screen.getByText(message)).toBeTruthy();
    expect(liveSource).toContain(message);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it("falls back to the live page's default when a refusal carries no message", async () => {
    api.get.mockRejectedValue(refusal(400, {}));
    await renderPage();
    await heading('Confirmation Failed');
    const message = 'Failed to confirm subscription. Please try again or contact support.';
    expect(screen.getByText(message)).toBeTruthy();
    expect(liveSource).toContain(message);
  });

  it('matches the expired answer exactly as the live page does', () => {
    expect(liveSource).toContain("data.error === 'Confirmation link expired'");
    for (const text of [
      'Invalid confirmation link. Please check your email for the correct link.',
      'This confirmation link has expired. Please subscribe again to receive a new confirmation email.',
      "Your subscription was already confirmed. You're all set!",
      'Confirming Your Subscription',
      'Please wait while we process your confirmation...',
      'Already Confirmed',
      'Confirmation Failed',
      'Need help? Contact us at',
    ]) {
      expect(liveSource).toContain(text);
    }
  });
});
