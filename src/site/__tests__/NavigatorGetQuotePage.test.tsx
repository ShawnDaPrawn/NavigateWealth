/**
 * The redesigned Get a Quote page, reached the way production reaches it:
 * GetQuotePage with the design switch on lazy-loads NavigatorGetQuotePage.
 * Covers what the redesign must not lose (the live page's SEO tags and
 * WebPage data, its copy, the seven services from the quote flow's data, each
 * card going exactly where the live page sends it, the ?service= and #hash
 * shortcuts) and what the board adds (the help card, the firm's credentials
 * from companyFacts).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const { GetQuotePage } = await import('../../components/pages/GetQuotePage');
const { QUOTE_SERVICES, TRUST_INDICATORS } = await import('../../components/pages/quote/constants');
const { COMPANY } = await import('../../config/companyFacts');
const { getSEOData } = await import('../../components/seo/seo-config');

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(resolve(here, path), 'utf8');
/** The live page, whitespace collapsed and entities decoded, so JSX line breaks do not matter. */
const liveSource = read('../../components/pages/GetQuotePage.tsx')
  .replace(/&apos;/g, "'")
  .replace(/\{' '\}/g, ' ')
  .replace(/\s+/g, ' ');
const appRoutesSource = read('../../app/AppRoutes.tsx');

/** Where the live page sends each service: its goToContact(). */
const LIVE_CONTACT_PATH = (id: string) => `/get-quote/${id}/contact`;

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

async function renderPage(path = '/get-quote') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/get-quote" element={<GetQuotePage />} />
        <Route path="/get-quote/:service/contact" element={<p>Contact step</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

async function renderGateway() {
  await renderPage();
  return screen.findByRole('heading', { level: 1 });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
  window.history.replaceState(null, '', '/');
});

describe('Navigator Get a Quote page', () => {
  it("has one H1: the board's headline, then a heading per card", async () => {
    const h1 = await renderGateway();
    expect(h1.textContent).toBe('Get Your Personalised Quote');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      ...QUOTE_SERVICES.map((s) => s.label),
      'Not sure where to start?',
    ]);
    const page = document.querySelector('.nwgq')!;
    const levels = [...page.querySelectorAll('h1, h2, h3, h4')].map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  it('emits the same SEO tags and WebPage data as the live page', async () => {
    await renderGateway();
    const seo = getSEOData('get-quote');
    await waitFor(() => expect(document.title).toBe(seo.title));
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      seo.description,
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      seo.canonicalUrl,
    );
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data['@type']).toBe('WebPage');
    expect(data.name).toBe(seo.title);
    expect(data.description).toBe(seo.description);
    expect(data.url).toBe(seo.canonicalUrl);
    // The live page builds the same data from the same entry.
    expect(liveSource).toContain("{...getSEOData('get-quote')}");
    expect(liveSource).toContain('structuredData={createWebPageSchema(');
  });

  it('links only to each service’s contact step, the booking page and the phone', async () => {
    await renderGateway();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      ...QUOTE_SERVICES.map((s) => LIVE_CONTACT_PATH(s.id)),
      '/schedule-consultation',
      COMPANY.phone.tel,
    ]);
    // The live page sends a tapped service to the same place.
    expect(liveSource).toContain('navigate(`/get-quote/${serviceId}/contact`)');
    expect(appRoutesSource).toContain('path="/get-quote/:service/contact"');
    expect(appRoutesSource).toContain('path="/schedule-consultation"');
  });

  it("shows every service with the quote flow's copy, in order, each card one link", async () => {
    await renderGateway();
    QUOTE_SERVICES.forEach((service, i) => {
      const card = screen.getByRole('link', { name: `Get a ${service.label} quote` });
      expect(card.getAttribute('href')).toBe(LIVE_CONTACT_PATH(service.id));
      expect(within(card).getByRole('heading', { level: 2 }).textContent).toBe(service.label);
      expect(within(card).getByText(service.description)).toBeDefined();
      expect(within(card).getByText(`0${i + 1}`)).toBeDefined();
      for (const chip of service.topicChips ?? []) {
        expect(within(card).getByText(chip)).toBeDefined();
      }
      expect(card.textContent).toContain('Start quote');
    });
  });

  it("keeps the live page's words: the hero, the steps and the closing line", async () => {
    const h1 = await renderGateway();
    const hero = h1.closest('section')!;
    const badge = 'Free, no-obligation quote';
    expect(within(hero).getByText(badge)).toBeDefined();
    expect(liveSource).toContain(badge);
    expect(liveSource).toContain('> Get Your Personalised Quote </h1>');
    const lead = within(hero).getByText(/^Tap a category below/).textContent!;
    expect(liveSource).toContain(lead);

    const highlights = within(hero)
      .getAllByRole('listitem')
      .map((li) => li.textContent!);
    expect(highlights).toEqual([
      '24hr response',
      'Independent advice',
      'FSCA regulated',
      'Established partners',
    ]);
    for (const label of highlights) expect(liveSource).toContain(`label: '${label}'`);

    const progress = screen.getByRole('navigation', { name: 'Quote progress' });
    const steps = within(progress).getAllByRole('listitem');
    expect(steps.map((li) => li.textContent)).toEqual([
      '1Choose your serviceMatch what you need (e.g. life cover) to the category below.',
      '2Your details',
      '3Quote details',
    ]);
    expect(steps[0].getAttribute('aria-current')).toBe('step');
    for (const text of [
      'Choose your service',
      'Match what you need (e.g. life cover) to the category below.',
      'Your details',
      'Quote details',
    ]) {
      expect(liveSource).toContain(text);
    }

    const hint = screen.getByText(/^Not sure which to pick\?/);
    expect(hint.textContent).toBe(
      'Not sure which to pick? Read the labels under each option — for example, life cover and income protection are under Risk Management.',
    );
    expect(liveSource).toContain(hint.textContent!.replace('Risk Management.', ''));

    const closing = 'Tap any category above to enter your details on the next page.';
    expect(screen.getByText(closing)).toBeDefined();
    expect(liveSource).toContain(closing);
  });

  it('promises no reply faster than the live page does', async () => {
    await renderGateway();
    const progress = screen.getByRole('navigation', { name: 'Quote progress' });
    expect(progress.textContent).toContain('An adviser replies within 24 hours');
    expect(progress.textContent).not.toContain('business day');
    expect(liveSource).toContain("label: '24hr response'");
  });

  it("offers a consultation and the firm's number, and its credentials, from companyFacts", async () => {
    await renderGateway();
    const help = screen.getByRole('heading', { level: 2, name: 'Not sure where to start?' })
      .parentElement!.parentElement!;
    expect(
      within(help)
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['Book a Free Consultation', '/schedule-consultation'],
      ['012 667 2505', COMPANY.phone.tel],
    ]);
    // The printed number is the companyFacts number.
    expect(`27${'012 667 2505'.replace(/\D/g, '').slice(1)}`).toBe(
      COMPANY.phone.tel.replace(/\D/g, ''),
    );

    const credentials = screen.getByText(`FSP ${COMPANY.fspNumber}`).closest('ul')!;
    expect(
      within(credentials)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(TRUST_INDICATORS.map((t) => t.label));
    expect(TRUST_INDICATORS[0].label).toBe(`FSP ${COMPANY.fspNumber}`);
  });

  it('draws every icon as decorative', async () => {
    await renderGateway();
    const page = document.querySelector('.nwgq')!;
    for (const svg of page.querySelectorAll('svg')) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
    expect(page.querySelectorAll('img')).toHaveLength(0);
  });

  it('sends ?service=<id> straight to the contact step, keeping ?will=true', async () => {
    await renderPage('/get-quote?service=estate-planning&will=true');
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe(
        '/get-quote/estate-planning/contact?will=true',
      ),
    );
  });

  it('sends #<id> straight to the contact step', async () => {
    window.history.replaceState(null, '', '/get-quote#medical-aid');
    await renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/get-quote/medical-aid/contact'),
    );
  });

  it('stays on the gateway for a service it does not know', async () => {
    await renderPage('/get-quote?service=crypto');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByTestId('location').textContent).toBe('/get-quote?service=crypto');
  });
});
