/**
 * The redesigned About page, reached the way production reaches it: AboutPage
 * with the design switch on lazy-loads NavigatorAboutPage. Covers what the
 * redesign must not lose (the SEO data, the founder's note and photograph,
 * the four topics word for word, links only to routes that exist, no figure
 * the firm cannot evidence) and how the topic tabs behave.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const { AboutPage } = await import('../../components/pages/AboutPage');
const { COMPANY, FOUNDER } = await import('../../config/companyFacts');
const { getSEOData } = await import('../../components/seo/seo-config');

/** The live page keeps its topics inline, so its source is what to check against. */
const liveAboutSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../components/pages/AboutPage.tsx'),
  'utf8',
);

async function renderPage(path = '/about') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AboutPage />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator About page', () => {
  it("has one H1: the board's headline", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Your Trusted Financial Partner');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('emits the same SEO tags and AboutPage data as the live page', async () => {
    await renderPage();
    const seo = getSEOData('about');
    await waitFor(() => expect(document.title).toBe(seo.title));
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      seo.canonicalUrl,
    );
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data['@type']).toBe('AboutPage');
  });

  it('links only to the founder note and to routes the site already serves', async () => {
    await renderPage();
    const targets = new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href')));
    expect(targets).toEqual(new Set(['#founder', '/careers', '/press']));
    expect(screen.getByRole('link', { name: /Meet Our Founder/ }).getAttribute('href')).toBe(
      '#founder',
    );
    expect(document.getElementById('founder')).not.toBeNull();
  });

  it('shows the firm as it appears on the register, from companyFacts', async () => {
    await renderPage();
    expect(screen.getByText(`FSCA-authorised · FSP ${COMPANY.fspNumber}`)).toBeDefined();
    const rows = [...document.querySelectorAll('.nwab-reg-row')].map((row) => [
      row.querySelector('dt')!.textContent,
      row.querySelector('dd')!.textContent,
    ]);
    expect(rows).toEqual([
      ['Trading name', COMPANY.tradingName],
      ['Legal name', COMPANY.legalName],
      ['Registration', COMPANY.registrationNumber],
      ['FSP number', COMPANY.fspNumber],
      ['Authorised', `${COMPANY.fscaAuthorisedOn} · FSCA`],
      ['Office', COMPANY.office],
      ['Languages', COMPANY.languages.join(', ')],
    ]);
  });

  it("carries the founder's note, by name, with his photograph", async () => {
    await renderPage();
    const section = document.getElementById('founder')!;
    expect(
      within(section).getByRole('heading', { level: 2, name: 'A Note From Our Founder' }),
    ).toBeDefined();
    const paragraphs = [...section.querySelectorAll('.nwab-note p')].map((p) => p.textContent);
    expect(paragraphs).toEqual([...FOUNDER.note]);

    const photo = within(section).getByAltText('Shawn Francisco, Founder of Navigate Wealth');
    const sources = [...photo.closest('picture')!.querySelectorAll('source')];
    expect(sources.map((s) => s.getAttribute('srcset')).join(' ')).toContain(FOUNDER.imageKey);
    expect(within(section).getAllByText(FOUNDER.name).length).toBeGreaterThan(0);
    expect(within(section).getByText(`${FOUNDER.name}, ${FOUNDER.title}`)).toBeDefined();
  });

  it('states no unbacked figures and no untraceable testimonials', async () => {
    await renderPage();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/years (of )?combined experience/i);
    expect(text).not.toMatch(/\d+\+ clients/i);
    expect(text).not.toMatch(/\d+% (client )?retention/i);
    expect(text).not.toMatch(/R500/i);
    expect(text).not.toMatch(/CFA/);
    expect(text).not.toMatch(/What Our Clients Say/);
    expect(text).toMatch(/FSP 54606/);
  });

  it('lands on the founder section when opened at /about#founder', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    await renderPage('/about#founder');
    expect(scrollIntoView).toHaveBeenCalled();
  });
});

describe('Navigator About topics', () => {
  function tabs() {
    return within(screen.getByRole('tablist', { name: 'About Navigate Wealth' })).getAllByRole(
      'tab',
    );
  }

  it('opens on Mission & Culture, with every topic in the document', async () => {
    await renderPage();
    expect(tabs().map((t) => t.textContent)).toEqual([
      '01Mission & Culture',
      '02Our Partners',
      '03Licensing',
      '04Radical Transparency',
    ]);
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('heading', { name: 'Our Mission & Culture' })).toBeDefined();
    // The other three are present but hidden, so search engines see them.
    const panels = [...document.querySelectorAll('[role="tabpanel"]')];
    expect(panels).toHaveLength(4);
    expect(panels.filter((p) => p.hasAttribute('hidden'))).toHaveLength(3);
  });

  it('switches topic on click, and with the arrow keys, Home and End', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Licensing' }));
    let panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(
      screen.getByRole('tab', { name: 'Licensing' }).id,
    );
    expect(within(panel).getByRole('heading', { name: 'Regulatory Compliance' })).toBeDefined();
    expect(panel.textContent).toContain(
      `${COMPANY.tradingName} is the trading name of ${COMPANY.legalName} (registration ${COMPANY.registrationNumber}), an authorised Financial Services Provider (FSP ${COMPANY.fspNumber}) licensed by the ${COMPANY.regulator} on ${COMPANY.fscaAuthorisedOn}.`,
    );

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Licensing' }), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Radical Transparency' }));
    panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('heading', { name: 'Complete Transparency' })).toBeDefined();

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Mission & Culture' }));
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Radical Transparency' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(screen.getByRole('tab', { name: 'Radical Transparency' }).getAttribute('tabindex')).toBe(
      '0',
    );
    expect(tabs().filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);
  });

  it("repeats the live page's topic copy word for word", async () => {
    await renderPage();
    const panels = [...document.querySelectorAll('[role="tabpanel"]')];
    const copy = panels.flatMap((p) => [
      p.querySelector('h3')!.textContent!,
      p.querySelector('.nwab-panel-desc')!.textContent!,
      ...[...p.querySelectorAll('.nwab-card')].flatMap((c) => [
        c.querySelector('h4')!.textContent!,
        c.querySelector('.nwab-card-text')!.textContent!,
      ]),
    ]);
    expect(copy).toHaveLength(32);
    // The FSP licence line is built from companyFacts in both files.
    const fromFacts = copy.filter((line) => line.includes(COMPANY.registrationNumber));
    expect(fromFacts).toHaveLength(1);
    for (const line of copy.filter((l) => !fromFacts.includes(l))) {
      expect(liveAboutSource).toContain(line);
    }
    for (const label of tabs().map((t) => t.textContent!.slice(2))) {
      expect(liveAboutSource).toContain(`label: '${label}'`);
    }
  });
});
