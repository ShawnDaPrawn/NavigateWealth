/**
 * The redesigned For Individuals page, reached the way production reaches it:
 * ForIndividualsPage with the design switch on lazy-loads
 * NavigatorForIndividualsPage. Covers what the redesign must not lose (the
 * SEO data, the services and their links, the live page's copy, links only to
 * routes that exist, no figure the firm cannot evidence) and what the board
 * adds (the audience selector, the milestones, the process, the FAQs).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const { ForIndividualsPage } = await import('../../components/pages/ForIndividualsPage');
const { getSEOData, commonFAQs } = await import('../../components/seo/seo-config');
const { services, lifeMilestones, digitalFeatures } =
  await import('../../components/pages/forIndividualsPageData');
const { ADVICE_PROCESS } = await import('../../components/pages/adviceProcess');
const { COMPANY, TRUST_FACTS } = await import('../../config/companyFacts');

const here = dirname(fileURLToPath(import.meta.url));
const squash = (text: string) => text.replace(/\s+/g, ' ');
/** The live page keeps its prose inline, so its source is what to check against. */
const liveSource = squash(
  readFileSync(resolve(here, '../../components/pages/ForIndividualsPage.tsx'), 'utf8'),
);
/** Every path the router serves. */
const routePaths = new Set(
  [
    ...readFileSync(resolve(here, '../../app/AppRoutes.tsx'), 'utf8').matchAll(/path="([^"]+)"/g),
  ].map((m) => m[1]),
);

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/solutions/individuals']}>
      <ForIndividualsPage />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

afterEach(() => {
  cleanup();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator For Individuals page', () => {
  it("has one H1: the board's main heading", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Financial Planning for Individuals');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps the headings in order, in the order the board draws its sections', async () => {
    await renderPage();
    const page = document.querySelector('.nwfi')!;
    const levels = [...page.querySelectorAll('h1, h2, h3, h4')].map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Your Financial Partner in Every Season',
      'Comprehensive Services',
      'Independent Advice, Personally Delivered',
      'Digital Convenience, Human Touch',
      'How We Work',
      'Frequently Asked Questions',
      'Ready to Take Control of Your Financial Future?',
    ]);
    const kickers = [...page.querySelectorAll('.nw-kicker')].map((k) => k.textContent);
    expect(kickers).toEqual([
      '01 — Every season',
      '02 — Services',
      '03 — Digital & human',
      '04 — Process',
      '05 — FAQ',
    ]);
  });

  it('links only to routes the site already serves', async () => {
    await renderPage();
    const hrefs = new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href')!));
    expect(hrefs).toEqual(
      new Set([
        '/schedule-consultation',
        '/get-quote',
        '/solutions/individuals',
        '/solutions/businesses',
        '/solutions/advisers',
        '/medical-aid',
        '/risk-management',
        '/retirement-planning',
        '/investment-management',
        '/estate-planning',
        '/tax-planning',
        '/contact',
        '/ask-vasco',
        COMPANY.phone.tel,
        `mailto:${COMPANY.email}`,
      ]),
    );
    for (const href of hrefs) {
      if (href.startsWith('/')) expect(routePaths, href).toContain(href);
    }
  });

  it('emits the same SEO data and JSON-LD as the live page', async () => {
    await renderPage();
    const seo = getSEOData('for-individuals');
    await waitFor(() => expect(document.title).toBe(seo.title));
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      seo.description,
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      seo.canonicalUrl,
    );
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data).toMatchObject({
      '@type': 'WebPage',
      name: seo.title,
      description: seo.description,
      url: seo.canonicalUrl,
    });
  });

  it('marks this page as the current one in the audience selector', async () => {
    await renderPage();
    const nav = screen.getByRole('navigation', { name: 'Solutions' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/solutions/individuals',
      '/solutions/businesses',
      '/solutions/advisers',
    ]);
    expect(links[0].getAttribute('aria-current')).toBe('page');
    expect(links[0].textContent).toContain('YOU ARE HERE');
    expect(links[1].hasAttribute('aria-current')).toBe(false);
    expect(links[2].hasAttribute('aria-current')).toBe(false);
  });

  it('states only the checkable facts from companyFacts', async () => {
    await renderPage();
    const hero = screen.getByRole('region', { name: 'Hero' });
    for (const { value, label } of TRUST_FACTS.slice(0, 3)) {
      expect(within(hero).getByText(value)).toBeDefined();
      expect(within(hero).getByText(label)).toBeDefined();
    }
    const text = document.querySelector('.nwfi')!.textContent!;
    // No client counts, experience totals, team sizes or asset figures.
    expect(text).not.toMatch(/\d+\s*\+|\byears?\b|\bclients served\b|\bR\s?\d/i);
    expect(text).toContain(`FSP ${COMPANY.fspNumber}`);
  });

  it('shows every service with its features and a link to its page', async () => {
    await renderPage();
    const region = screen.getByRole('region', { name: 'Comprehensive Services' });
    for (const service of services) {
      const title = within(region).getByRole('heading', { level: 3, name: service.title });
      const card = title.closest('a')!;
      expect(card.getAttribute('href')).toBe(service.link);
      expect(card.textContent).toContain(service.description);
      for (const feature of service.features) expect(card.textContent).toContain(feature);
    }
    expect(
      within(region)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/get-quote', ...services.map((s) => s.link)]);
  });

  it('shows the milestones, the digital features and the four legs of the process', async () => {
    await renderPage();
    for (const { title, description } of [...lifeMilestones, ...digitalFeatures]) {
      expect(screen.getByText(title)).toBeDefined();
      expect(screen.getByText(description)).toBeDefined();
    }
    const process = screen.getByRole('region', { name: 'How We Work' });
    for (const step of ADVICE_PROCESS) {
      expect(within(process).getByRole('heading', { level: 3, name: step.title })).toBeDefined();
      expect(within(process).getByText(`LEG ${step.step}`)).toBeDefined();
      expect(within(process).getByText(step.description)).toBeDefined();
    }
    const photo = screen.getByAltText('Family financial planning consultation');
    expect(photo.getAttribute('src')).toContain('solutions-menu');
  });

  it("repeats the live page's copy word for word", async () => {
    await renderPage();
    const page = document.querySelector('.nwfi')!;
    const passages = [
      ...page.querySelectorAll(
        '.nwfi-hero-lead, .nw-sec-lead, .nwfi-indep-p, .nwfi-digital-body, .nwfi-cta-p',
      ),
    ]
      .map((p) => p.textContent!)
      // The process and FAQ leads come from the home page and the FAQ source.
      .filter((p) => !p.startsWith('A simple, transparent') && !p.startsWith('Answers to'));
    expect(passages).toHaveLength(7);
    for (const passage of passages) expect(liveSource).toContain(squash(passage));
    for (const heading of [
      'Your Financial Partner in Every Season',
      'Comprehensive Services',
      'Independent Advice, Personally Delivered',
      'Digital Convenience, Human Touch',
      'Ready to Take Control of Your Financial Future?',
    ]) {
      expect(liveSource).toContain(heading);
    }
  });

  it("asks the board's four questions from the shared FAQ source, answers kept in the page", async () => {
    await renderPage();
    const faq = screen.getByRole('region', { name: 'Frequently asked questions' });
    const buttons = within(faq).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'How do I get started with Navigate Wealth?',
      'Is Navigate Wealth an independent financial advisor?',
      'What services does Navigate Wealth offer?',
      'Does Navigate Wealth operate across South Africa?',
    ]);
    for (const button of buttons) {
      const entry = commonFAQs.find((f) => f.question === button.textContent)!;
      const answer = document.getElementById(button.getAttribute('aria-controls')!)!;
      expect(answer.textContent).toBe(entry.answer);
    }
    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
    expect(buttons[1].getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(buttons[1]);
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(buttons[1].getAttribute('aria-controls')!)!.hidden).toBe(false);
  });

  it('gives every image alternative text and hides the decorative drawings', async () => {
    await renderPage();
    const page = document.querySelector('.nwfi')!;
    for (const img of page.querySelectorAll('img')) expect(img.hasAttribute('alt')).toBe(true);
    for (const svg of page.querySelectorAll('svg')) {
      expect(svg.closest('[aria-hidden="true"]'), svg.outerHTML.slice(0, 80)).not.toBeNull();
    }
    expect(page.querySelector('.nwfi-portal')!.getAttribute('aria-hidden')).toBe('true');
  });
});
