/**
 * The redesigned newsletter unsubscribe page, reached the way production
 * reaches it: NewsletterUnsubscribePage with the design switch on lazy-loads
 * NavigatorNewsletterUnsubscribePage. Covers what the redesign must not lose
 * (the SEO tags, nothing sent until the visitor asks, the unsubscribe request
 * exactly as the live page makes it, every state and its live wording, the
 * disabled button for a link without an address) and what it adds (subscribing
 * the same address again in place, as the footer subscribes).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../utils/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/api/client')>()),
  api,
}));

const { NewsletterUnsubscribePage } =
  await import('../../components/pages/NewsletterUnsubscribePage');
const { NEWSLETTER_UNSUBSCRIBE_SEO } = await import('../../components/pages/newsletterStatusData');
const { COMPANY } = await import('../../config/companyFacts');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8');
/** The live page, whitespace collapsed so JSX line breaks do not matter. */
const liveSource = read('../../components/pages/NewsletterUnsubscribePage.tsx').replace(
  /\s+/g,
  ' ',
);
const footerSource = read('../layout/NavigatorFooter.tsx').replace(/\s+/g, ' ');

async function renderPage(search = '?email=thandi%40example.com') {
  render(
    <MemoryRouter initialEntries={[`/newsletter/unsubscribe${search}`]}>
      <Routes>
        <Route path="/newsletter/unsubscribe" element={<NewsletterUnsubscribePage />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

async function heading(text: string) {
  const h1 = await screen.findByRole('heading', { level: 1, name: text });
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  return h1;
}

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Navigator newsletter unsubscribe page', () => {
  it("asks first, with one H1, the address and the live page's words", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Unsubscribe from Newsletter');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const intro =
      "We're sorry to see you go! Click the button below to unsubscribe from Navigate Wealth's newsletter.";
    expect(screen.getByText(intro)).toBeTruthy();
    expect(liveSource).toContain(
      "We're sorry to see you go! Click the button below to unsubscribe from Navigate Wealth's newsletter.",
    );
    expect(screen.getByText('thandi@example.com').tagName).toBe('STRONG');
    expect(
      screen.getByRole('link', { name: 'Keep Subscription & Return Home' }).getAttribute('href'),
    ).toBe('/');
    const note = 'You can always resubscribe later by signing up again on our website.';
    expect(screen.getByText(note)).toBeTruthy();
    expect(liveSource).toContain(note);
    expect(screen.getByRole('link', { name: COMPANY.email }).getAttribute('href')).toBe(
      `mailto:${COMPANY.email}`,
    );
    expect(api.get).not.toHaveBeenCalled();
  });

  it('emits the same SEO tags as the live page, kept out of search', async () => {
    await renderPage();
    await waitFor(() => expect(document.title).toBe(NEWSLETTER_UNSUBSCRIBE_SEO.title));
    expect(document.title).toBe('Newsletter Unsubscribe | Navigate Wealth');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://www.navigatewealth.co/newsletter/unsubscribe',
    );
    expect(liveSource).toContain('NEWSLETTER_UNSUBSCRIBE_SEO as seoProps');
  });

  it('keeps the button disabled when the link carries no address, as live does', async () => {
    await renderPage('');
    await heading('Unsubscribe from Newsletter');
    expect(screen.queryByText(/Email:/)).toBeNull();
    const button = screen.getByRole('button', { name: 'Unsubscribe' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(liveSource).toContain('disabled={!email}');
  });

  it('unsubscribes through the public route exactly as the live page does', async () => {
    let answer: (value: unknown) => void = () => {};
    api.get.mockReturnValue(new Promise((done) => (answer = done)));
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));

    await heading('Processing Unsubscribe');
    expect(screen.getByText('Please wait...')).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/newsletter/unsubscribe?email=thandi%40example.com');
    expect(liveSource).toContain(
      'api.get<{ notFound?: boolean }>( `/newsletter/unsubscribe?email=${encodeURIComponent(email)}`, );',
    );

    answer({ success: true });
    await heading('Unsubscribed Successfully');
    const message =
      "You have been successfully unsubscribed from our newsletter. We're sorry to see you go!";
    expect(screen.getByText(message)).toBeTruthy();
    expect(liveSource).toContain(message);
    expect(screen.getByRole('link', { name: 'Return to Homepage' }).getAttribute('href')).toBe('/');
    expect(
      screen.getByText(/Changed your mind\? You can always resubscribe from our website footer/),
    ).toBeTruthy();
    expect(liveSource).toContain(
      'Changed your mind? You can always resubscribe from our website footer',
    );
  });

  it('subscribes the address again in place, as the footer subscribes', async () => {
    api.get.mockResolvedValue({ success: true });
    api.post.mockResolvedValue({ requiresConfirmation: true });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    await heading('Unsubscribed Successfully');

    fireEvent.click(screen.getByRole('button', { name: 'resubscribe thandi@example.com now' }));
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Check your email!');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(
      '/newsletter/subscribe',
      { email: 'thandi@example.com' },
      { retryTransientFailures: false },
    );
    expect(footerSource).toContain(
      "'/newsletter/subscribe', { email }, { retryTransientFailures: false },",
    );
  });

  it("gives the footer's answers for an address already on the list, or a failure", async () => {
    api.get.mockResolvedValue({ success: true });
    api.post.mockRejectedValueOnce(new Error('Validation failed'));
    api.post.mockResolvedValueOnce({ alreadySubscribed: true });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    await heading('Unsubscribed Successfully');

    const offer = screen.getByRole('button', { name: /resubscribe/ });
    fireEvent.click(offer);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Subscription failed Validation failed',
    );
    fireEvent.click(offer);
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Already subscribed');
    expect(status.textContent).toContain(
      "You're already on our mailing list. We'll keep sending you great content!",
    );
  });

  it('shows the live answer for an address with no subscription', async () => {
    api.get.mockResolvedValue({ notFound: true });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    await heading('Unsubscribe Failed');
    const message = 'Subscription not found. You may have already unsubscribed.';
    expect(screen.getByText(message)).toBeTruthy();
    expect(liveSource).toContain(message);
    expect(screen.getByRole('link', { name: 'Return to Homepage' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('button', { name: /resubscribe/ })).toBeNull();
  });

  it('shows the live answer when the request fails', async () => {
    api.get.mockRejectedValue(new Error('Network error'));
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    await heading('Unsubscribe Failed');
    const message = 'An error occurred while unsubscribing. Please try again later.';
    expect(screen.getByText(message)).toBeTruthy();
    expect(liveSource).toContain(message);
  });

  it("keeps the live page's other words", () => {
    for (const text of [
      'Invalid unsubscribe link. Please use the link from your email.',
      'Unsubscribe from Newsletter',
      'Processing Unsubscribe',
      'Unsubscribed Successfully',
      'Unsubscribe Failed',
      'Keep Subscription & Return Home',
      'Need help? Contact us at',
    ]) {
      expect(liveSource).toContain(text);
    }
  });
});
