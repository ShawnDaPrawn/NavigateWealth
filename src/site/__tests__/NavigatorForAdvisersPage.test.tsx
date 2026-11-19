/**
 * The redesigned For Advisers page, reached the way production reaches it:
 * ForAdvisersPage with the design switch on lazy-loads NavigatorForAdvisersPage.
 * Covers what the redesign must not lose — the live page's copy, services,
 * stages and support features (from the shared data module), its SEO tags and
 * WebPage JSON-LD — and that every link goes to a route the site serves,
 * every fact about the firm comes from companyFacts, and the FAQ answers stay
 * in the document while collapsed. The live page has no form, so neither does
 * this one.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const { ForAdvisersPage } = await import('../../components/pages/ForAdvisersPage');
const { getSEOData, commonFAQs } = await import('../../components/seo/seo-config');
const { createWebPageSchema } = await import('../../components/seo/SEO');
const { COMPANY, TRUST_FACTS } = await import('../../config/companyFacts');
const { ADVICE_PROCESS } = await import('../../components/pages/adviceProcess');
const { solutionItems } = await import('../../components/layout/navigationData');
const { services, practiceStages, digitalFeatures } =
  await import('../../components/pages/forAdvisersPageData');

const here = dirname(fileURLToPath(import.meta.url));
/** The live page keeps its headings and leads inline, so its source is what to check against. */
const liveSource = readFileSync(
  resolve(here, '../../components/pages/ForAdvisersPage.tsx'),
  'utf8',
).replace(/\s+/g, ' ');
const appRoutes = readFileSync(resolve(here, '../../app/AppRoutes.tsx'), 'utf8');

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/solutions/advisers']}>
      <ForAdvisersPage />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

afterEach(() => {
  cleanup();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator For Advisers page', () => {
  it("has one H1, the board's heading", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Succession Planning for Advisers');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps headings in order, the sections as H2 and their items as H3', async () => {
    await renderPage();
    const outline = screen
      .getAllByRole('heading')
      .map((h) => `${h.tagName}:${h.textContent?.trim()}`);
    expect(outline).toEqual([
      'H1:Succession Planning for Advisers',
      'H2:Supporting Your Practice Journey at Every Stage',
      'H2:Comprehensive Succession & Advisory Services',
      ...services.map((s) => `H3:${s.title}`),
      'H2:Practice Transitions, Handled Personally',
      'H2:Comprehensive Support Throughout Your Transition',
      'H2:How We Work',
      ...ADVICE_PROCESS.map((s) => `H3:${s.title}`),
      'H2:Frequently Asked Questions',
      'H3:Is Navigate Wealth an independent financial advisor?',
      'H3:How do I get started with Navigate Wealth?',
      'H3:Does Navigate Wealth operate across South Africa?',
      "H2:Ready to Secure Your Practice's Future?",
    ]);
  });

  it('links only to routes the site already serves', async () => {
    await renderPage();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');
    expect(new Set(hrefs)).toEqual(
      new Set([
        '/schedule-consultation',
        '/get-quote',
        '/solutions/individuals',
        '/solutions/businesses',
        '/solutions/advisers',
        '/contact?type=advisors',
        '/risk-management',
        '/ask-vasco',
        COMPANY.phone.tel,
        `mailto:${COMPANY.email}`,
      ]),
    );
    for (const href of hrefs.filter((h) => h.startsWith('/'))) {
      expect(appRoutes).toContain(`path="${href.split('?')[0]}"`);
    }
  });

  it("emits the live page's SEO tags and WebPage JSON-LD", async () => {
    await renderPage();
    const seo = getSEOData('for-advisers');
    await waitFor(() => expect(document.title).toBe(seo.title));
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      seo.description,
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      seo.canonicalUrl,
    );
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data).toEqual(createWebPageSchema(seo.title, seo.description, seo.canonicalUrl));
  });

  it('opens with the live copy, both actions, and the three solutions pages', async () => {
    await renderPage();
    const hero = screen.getByRole('region', { name: 'Hero' });
    expect(within(hero).getByText('Succession & Practice Management')).toBeDefined();
    expect(
      within(hero)
        .getByRole('link', { name: /Book a Free Consultation/ })
        .getAttribute('href'),
    ).toBe('/schedule-consultation');
    expect(within(hero).getByRole('link', { name: 'Get a Quote' }).getAttribute('href')).toBe(
      '/get-quote',
    );

    const nav = within(hero).getByRole('navigation', { name: 'Solutions' });
    const paths = within(nav).getAllByRole('link');
    expect(paths.map((a) => a.getAttribute('href'))).toEqual(solutionItems.map((s) => s.path));
    solutionItems.forEach((item, i) => {
      expect(paths[i].textContent).toContain(item.label);
      expect(paths[i].textContent).toContain(item.description);
    });
    const current = paths.filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0].getAttribute('href')).toBe('/solutions/advisers');
    expect(current[0].textContent).toContain('YOU ARE HERE');
  });

  it('states only facts from companyFacts', async () => {
    await renderPage();
    const hero = screen.getByRole('region', { name: 'Hero' });
    for (const fact of TRUST_FACTS.slice(0, 3)) {
      expect(within(hero).getByText(fact.value)).toBeDefined();
      expect(within(hero).getByText(fact.label)).toBeDefined();
    }
    expect(within(hero).getByText(`FSP ${COMPANY.fspNumber}`)).toBeDefined();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\d+\+|years (of )?experience|practices acquired|books? acquired/i);
    expect(text).not.toMatch(/\bR\s?\d/);
  });

  it('repeats the live page’s headings and leads word for word', async () => {
    await renderPage();
    // The process and FAQ heads are the shared ones the home page uses.
    const shared = [
      'How We Work',
      'Frequently Asked Questions',
      'A simple, transparent process designed to put your financial goals at the centre of every decision.',
      'Answers to the questions South Africans ask us most about independent financial advice.',
    ];
    const copy = [
      ...document.querySelectorAll(
        '.nwfa h2, .nwfa-lead, .nw-sec-lead, .nwfa-band-lead, .nwfa-note, .nwfa-cta-lead',
      ),
    ]
      .map((el) => el.textContent!)
      .filter((line) => !shared.includes(line));
    expect(copy).toHaveLength(12);
    for (const line of copy) expect(liveSource).toContain(line);
    // The live H1 splits its accent into a span.
    expect(liveSource).toMatch(/Succession Planning\{' '\} <span[^>]*> for Advisers <\/span>/);
  });

  it('shows the six services from the shared data, each linking on', async () => {
    await renderPage();
    const list = document.querySelector('.nwfa-cards')!;
    const cards = within(list as HTMLElement).getAllByRole('link');
    expect(cards).toHaveLength(services.length);
    services.forEach((service, i) => {
      const card = cards[i];
      expect(card.getAttribute('href')).toBe(service.link);
      expect(within(card).getByRole('heading', { level: 3 }).textContent).toBe(service.title);
      expect(within(card).getByText(service.description)).toBeDefined();
      for (const feature of service.features) expect(within(card).getByText(feature)).toBeDefined();
      expect(card.textContent).toContain(
        service.link === '/risk-management' ? 'Learn More' : 'Discuss with us',
      );
    });
  });

  it('shows the practice stages, the support features and the advice process', async () => {
    await renderPage();
    const stages = [...document.querySelectorAll('.nwfa-stages > li')].map((li) => [
      li.querySelector('.nwfa-stage-t')!.textContent,
      li.querySelector('.nwfa-stage-d')!.textContent,
    ]);
    expect(stages).toEqual(practiceStages.map((s) => [s.title, s.description]));

    const features = [...document.querySelectorAll('.nwfa-feats > li')].map((li) => [
      li.querySelector('.nwfa-feat-t')!.textContent,
      li.querySelector('.nwfa-feat-d')!.textContent,
    ]);
    expect(features).toEqual(digitalFeatures.map((f) => [f.title, f.description]));

    // The route illustration is a picture, hidden from assistive technology.
    expect(document.querySelector('.nwfa-route')!.getAttribute('aria-hidden')).toBe('true');

    const legs = [...document.querySelectorAll('.nwfa-legs > li')].map((li) => [
      li.querySelector('.nwfa-leg-no')!.textContent,
      li.querySelector('h3')!.textContent,
      li.querySelector('p')!.textContent,
    ]);
    expect(legs).toEqual(ADVICE_PROCESS.map((s) => [`LEG ${s.step}`, s.title, s.description]));
  });

  it('shows the consultation photograph from the repo’s optimised set, with alt text', async () => {
    await renderPage();
    const photo = screen.getByAltText('Financial advice consultation in a meeting room');
    const picture = photo.closest('picture')!;
    expect(picture.querySelector('source[type="image/avif"]')!.getAttribute('srcset')).toContain(
      'company-menu',
    );
    // Phones never download it: the layout hides it below 760px.
    expect(picture.querySelector('source[media="(max-width: 760px)"]')).not.toBeNull();
    for (const img of document.querySelectorAll('.nwfa img')) {
      expect(img.hasAttribute('alt')).toBe(true);
    }
  });

  it('keeps every FAQ answer in the document, opening one at a time', async () => {
    await renderPage();
    const faq = screen.getByRole('region', { name: 'Frequently asked questions' });
    const expected = [
      'Is Navigate Wealth an independent financial advisor?',
      'How do I get started with Navigate Wealth?',
      'Does Navigate Wealth operate across South Africa?',
    ].map((q) => commonFAQs.find((f) => f.question === q)!);
    for (const { question, answer } of expected) {
      expect(within(faq).getByRole('button', { name: question })).toBeDefined();
      expect(within(faq).getByText(answer, { selector: 'p' })).toBeDefined();
    }
    const first = within(faq).getByRole('button', { name: expected[0].question });
    const second = within(faq).getByRole('button', { name: expected[1].question });
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(second.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(second);
    expect(first.getAttribute('aria-expanded')).toBe('false');
    expect(second.getAttribute('aria-expanded')).toBe('true');
    expect(
      document.getElementById(second.getAttribute('aria-controls')!)!.hasAttribute('hidden'),
    ).toBe(false);
    expect(
      within(faq)
        .getByRole('link', { name: /Contact Us/ })
        .getAttribute('href'),
    ).toBe('/contact?type=advisors');
  });

  it('closes with both actions and the assurance line', async () => {
    await renderPage();
    const cta = screen.getByRole('region', { name: "Ready to Secure Your Practice's Future?" });
    expect(
      within(cta)
        .getByRole('link', { name: /Get Your Succession Plan/ })
        .getAttribute('href'),
    ).toBe('/contact?type=advisors');
    expect(within(cta).getByRole('link', { name: 'Book Consultation' }).getAttribute('href')).toBe(
      '/schedule-consultation',
    );
    for (const item of ['Confidential consultation', 'No obligation', 'Succession expertise']) {
      expect(within(cta).getByText(item)).toBeDefined();
    }
  });
});
