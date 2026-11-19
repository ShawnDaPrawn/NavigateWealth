/**
 * The redesigned Services overview page, reached the way production reaches
 * it: ServicesPage with the design switch on lazy-loads NavigatorServicesPage.
 * Covers what the redesign must not lose (the live page's SEO tags, the eight
 * services and their copy, the reasons, the advice process, links only to
 * routes that exist, the FSP number from companyFacts) and what the board
 * adds (the service index that jumps to each row).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const { ServicesPage } = await import('../../components/pages/ServicesPage');
const { SERVICES, WHY_US } = await import('../../components/pages/servicesPageData');
const { ADVICE_PROCESS } = await import('../../components/pages/adviceProcess');
const { COMPANY } = await import('../../config/companyFacts');
const { SITE_ORIGIN } = await import('../../utils/siteOrigin');

/** The live page sets its SEO tags inline, so its source is what to check against. */
const liveServicesSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../components/pages/ServicesPage.tsx'),
  'utf8',
);

/** Every route the board's links map to, as src/app/AppRoutes.tsx serves them. */
const appRoutesSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../app/AppRoutes.tsx'),
  'utf8',
);

async function renderPage(path = '/services') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesPage />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator Services page', () => {
  it("has one H1: the board's headline", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Financial Solutions for Every Stage of Life');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps the headings in order', async () => {
    await renderPage();
    const page = document.querySelector('.nwsv')!;
    const levels = [...page.querySelectorAll('h1, h2, h3, h4')].map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Our Services',
      'Why Choose Navigate Wealth?',
      'How We Work',
      'Ready to Take the First Step?',
    ]);
  });

  it('emits the same SEO tags as the live page', async () => {
    await renderPage();
    const title = 'Financial Advice Services in South Africa | Navigate Wealth';
    await waitFor(() => expect(document.title).toBe(title));
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content');
    const keywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SITE_ORIGIN}/services`,
    );
    // Word for word what the live page sets.
    expect(liveServicesSource).toContain(`title="${title}"`);
    expect(liveServicesSource).toContain(`description="${description}"`);
    for (const keyword of keywords!.split(', ')) {
      expect(liveServicesSource).toContain(`'${keyword}',`);
    }
    expect(liveServicesSource).toContain('canonicalUrl={`${SITE_ORIGIN}/services`}');
    // The live page emits no structured data, so neither does the redesign.
    expect(liveServicesSource).not.toContain('structuredData');
    expect(document.getElementById('seo-structured-data')).toBeNull();
  });

  it('links only to its own rows and to routes the site already serves', async () => {
    await renderPage();
    const targets = new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href')));
    const anchors = SERVICES.map((s) => `#${s.id}`);
    const routes = [...SERVICES.map((s) => s.path), '/get-quote', '/schedule-consultation'];
    expect(targets).toEqual(new Set([...anchors, ...routes]));
    for (const route of routes) {
      expect(appRoutesSource).toContain(`path="${route}"`);
    }
    // Each anchor lands on the row that links to that service.
    for (const service of SERVICES) {
      const row = document.getElementById(service.id)!;
      expect(row.getAttribute('href')).toBe(service.path);
    }
  });

  it('indexes every service in the hero, in order', async () => {
    await renderPage();
    const index = screen.getByRole('navigation', { name: 'Service index' });
    expect(index.textContent).toContain('Chart your course');
    expect(index.textContent).toContain('08 services');
    const links = within(index).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(SERVICES.map((s, i) => `0${i + 1}${s.title}`));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(SERVICES.map((s) => `#${s.id}`));
  });

  it("lists every service with the live page's copy, each row one link to its page", async () => {
    await renderPage();
    const list = screen.getByRole('region', { name: 'Our Services' });
    for (const service of SERVICES) {
      const link = within(list).getByRole('link', { name: service.title });
      expect(link.getAttribute('href')).toBe(service.path);
      expect(within(link).getByRole('heading', { level: 3 }).textContent).toBe(service.title);
      expect(within(link).getByText(service.description)).toBeDefined();
      expect(
        within(link)
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      ).toEqual(service.highlights);
      // The photograph is decorative: the link already names the service.
      const img = link.querySelector('img')!;
      expect(img.getAttribute('alt')).toBe('');
    }
  });

  it('shows the reasons, the four legs of the process and the firm’s FSP number', async () => {
    await renderPage();
    const why = screen.getByRole('region', { name: 'Why Choose Navigate Wealth?' });
    for (const reason of WHY_US) {
      expect(within(why).getByRole('heading', { level: 3, name: reason.title })).toBeDefined();
      expect(within(why).getByText(reason.description)).toBeDefined();
    }
    const process = screen.getByRole('region', { name: 'How We Work' });
    const steps = within(process).getAllByRole('listitem');
    expect(steps).toHaveLength(ADVICE_PROCESS.length);
    ADVICE_PROCESS.forEach((step, i) => {
      expect(steps[i].textContent).toBe(`LEG ${step.step}${step.title}${step.description}`);
    });
    const trust = screen.getByRole('list', { name: 'Why clients choose us' });
    expect(
      within(trust)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      `FSCA-authorised · FSP ${COMPANY.fspNumber}`,
      'Independent advice',
      'Free first consultation',
    ]);
  });

  it('offers a quote and a consultation in the hero and in the closing call to action', async () => {
    await renderPage();
    const hero = screen.getByRole('region', {
      name: 'Financial Solutions for Every Stage of Life',
    });
    expect(
      within(hero)
        .getAllByRole('link')
        .filter((a) => !a.closest('nav'))
        .map((a) => [a.textContent?.trim(), a.getAttribute('href')]),
    ).toEqual([
      ['Get a Quote', '/get-quote'],
      ['Book a Free Consultation', '/schedule-consultation'],
    ]);
    const cta = screen.getByRole('region', { name: 'Ready to Take the First Step?' });
    expect(cta.textContent).toContain('Free initial consultation');
    expect(
      within(cta)
        .getAllByRole('link')
        .map((a) => [a.textContent?.trim(), a.getAttribute('href')]),
    ).toEqual([
      ['Book a Free Consultation', '/schedule-consultation'],
      ['Get a Quote', '/get-quote'],
    ]);
  });

  it('scrolls to the row a link from another page names', async () => {
    const original = Element.prototype.scrollIntoView;
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
    try {
      await renderPage('/services#tax-planning');
      await waitFor(() => expect(scrolled).toEqual([document.getElementById('tax-planning')]));
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
