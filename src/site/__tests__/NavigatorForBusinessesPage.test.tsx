/**
 * The redesigned For Businesses page, reached the way production reaches it:
 * ForBusinessesPage with the design switch on lazy-loads
 * NavigatorForBusinessesPage. Covers what the redesign must not lose (the
 * live page's SEO tags and WebPage JSON-LD, its copy, the checkable facts)
 * and what the board adds (the solutions panel, the advice process, the FAQ
 * accordion), and that every link goes to a route the site serves.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const { ForBusinessesPage } = await import('../../components/pages/ForBusinessesPage');
const { commonFAQs, getSEOData } = await import('../../components/seo/seo-config');
const { createWebPageSchema } = await import('../../components/seo/SEO');
const { ADVICE_PROCESS } = await import('../../components/pages/adviceProcess');
const { services, businessStages, digitalFeatures } =
  await import('../../components/pages/forBusinessesPageData');
const { COMPANY, TRUST_FACTS } = await import('../../config/companyFacts');

/** Public routes in src/app/AppRoutes.tsx that this page links to. */
const SERVED_ROUTES = [
  '/schedule-consultation',
  '/get-quote',
  '/solutions/individuals',
  '/solutions/businesses',
  '/solutions/advisers',
  '/employee-benefits',
  '/risk-management',
  '/investment-management',
  '/tax-planning',
  '/contact',
  '/ask-vasco',
];

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/solutions/businesses']}>
      <ForBusinessesPage />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

afterEach(() => {
  cleanup();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator For Businesses page', () => {
  it("has one H1: the board's main heading", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Financial Solutions for Businesses');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps the headings in order, ending with the call to action', async () => {
    await renderPage();
    const page = document.querySelector('.nwfb')!;
    const levels = [...page.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
      Number(h.tagName[1]),
    );
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Your Strategic Financial Partner at Every Stage',
      'Comprehensive Business Solutions',
      'Independent Advice with Personal Service',
      'Modern Technology, Expert Partnership',
      'How We Work',
      'Frequently Asked Questions',
      'Ready to Optimize Your Business Finances?',
    ]);
  });

  it('links only to routes the site already serves, and to the firm’s contacts', async () => {
    await renderPage();
    const targets = new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href')));
    expect(targets).toEqual(
      new Set([...SERVED_ROUTES, COMPANY.phone.tel, `mailto:${COMPANY.email}`]),
    );
    const routes = readFileSync('src/app/AppRoutes.tsx', 'utf8');
    for (const path of SERVED_ROUTES) expect(routes).toContain(`path="${path}"`);
  });

  it("emits the live page's SEO tags and WebPage data", async () => {
    await renderPage();
    const seo = getSEOData('for-businesses');
    await waitFor(() => expect(document.title).toBe(seo.title));
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      seo.description,
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      seo.canonicalUrl,
    );
    expect(JSON.parse(document.getElementById('seo-structured-data')!.textContent!)).toEqual(
      createWebPageSchema(seo.title, seo.description, seo.canonicalUrl),
    );
  });

  it('states only the checkable facts from companyFacts', async () => {
    await renderPage();
    const hero = screen.getByRole('region', { name: 'Hero' });
    for (const { value, label } of TRUST_FACTS.slice(0, 3)) {
      expect(within(hero).getByText(value)).toBeDefined();
      expect(within(hero).getByText(label)).toBeDefined();
    }
    expect(screen.getByRole('link', { name: COMPANY.email })).toBeDefined();
    expect(document.body.textContent).not.toMatch(/\d+\+|years of (combined )?experience/i);
  });

  it('marks this page in the solutions panel', async () => {
    await renderPage();
    const panel = screen.getByRole('navigation', { name: 'Solutions' });
    const links = within(panel).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/solutions/individuals',
      '/solutions/businesses',
      '/solutions/advisers',
    ]);
    expect(links[1].getAttribute('aria-current')).toBe('page');
    expect(within(links[1]).getByText('YOU ARE HERE')).toBeDefined();
    expect(links.filter((a) => a.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it("carries the live page's services, stages and platform features", async () => {
    await renderPage();
    for (const service of services) {
      const card = screen.getByRole('link', { name: new RegExp(`^${service.title}`) });
      expect(card.getAttribute('href')).toBe(service.link);
      expect(within(card).getByRole('heading', { level: 3, name: service.title })).toBeDefined();
      expect(within(card).getByText(service.description)).toBeDefined();
      for (const feature of service.features) expect(within(card).getByText(feature)).toBeDefined();
    }
    for (const stage of businessStages) {
      expect(screen.getByText(stage.title)).toBeDefined();
      expect(screen.getByText(stage.description)).toBeDefined();
    }
    for (const feature of digitalFeatures) {
      expect(screen.getByText(feature.description)).toBeDefined();
    }
    expect(
      screen.getByAltText('Corporate business team discussing financial strategy'),
    ).toBeDefined();
  });

  it('shows the four legs of the advice process', async () => {
    await renderPage();
    for (const step of ADVICE_PROCESS) {
      expect(screen.getByRole('heading', { level: 3, name: step.title })).toBeDefined();
      expect(screen.getByText(`LEG ${step.step}`)).toBeDefined();
      expect(screen.getByText(step.description)).toBeDefined();
    }
  });

  it('opens one FAQ answer at a time, keeping the others in the page', async () => {
    await renderPage();
    const faqs = commonFAQs.slice(0, 4);
    const questions = faqs.map((f) => screen.getByRole('button', { name: f.question }));
    expect(screen.queryByRole('button', { name: commonFAQs[4].question })).toBeNull();
    expect(questions.map((q) => q.getAttribute('aria-expanded'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
    // Collapsed answers stay in the document, hidden.
    for (const faq of faqs) expect(screen.getByText(faq.answer)).toBeDefined();

    fireEvent.click(questions[2]);
    expect(questions.map((q) => q.getAttribute('aria-expanded'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ]);
    const answer = document.getElementById(questions[2].getAttribute('aria-controls')!)!;
    expect(answer.hidden).toBe(false);
    expect(answer.textContent).toBe(faqs[2].answer);
  });
});
