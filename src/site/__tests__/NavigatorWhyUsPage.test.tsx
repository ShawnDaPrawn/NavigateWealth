/**
 * The redesigned "Why Us?" page, reached the way production reaches it:
 * WhyUsPage with the design switch on lazy-loads NavigatorWhyUsPage. Covers
 * what the redesign must not lose (the SEO data, the checkable facts, the
 * partner list, the links) and what the board adds (the core values as
 * compass tabs, the partners dialog).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const { WhyUsPage } = await import('../../components/pages/WhyUsPage');
const { getSEOData } = await import('../../components/seo/seo-config');
const { PROVIDER_GROUPS } = await import('../../components/shared/providerGroups');
const { COMPANY, TRUST_FACTS } = await import('../../config/companyFacts');

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/why-us']}>
      <WhyUsPage />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

afterEach(() => {
  cleanup();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator "Why Us?" page', () => {
  it("has one H1: the board's main heading", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Why Choose Navigate Wealth?');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps the headings in order, ending with the call to action', async () => {
    await renderPage();
    const page = document.querySelector('.nwwu')!;
    const levels = [...page.querySelectorAll('h1, h2, h3, h4')].map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    }
    const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(h2s).toEqual([
      'What Makes Us Different',
      'The Navigate Wealth Advantage',
      'How We Work With You',
      'Experience the Navigate Wealth Difference',
    ]);
  });

  it('links only to routes the site already serves', async () => {
    await renderPage();
    const targets = new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href')));
    expect(targets).toEqual(new Set(['/schedule-consultation', '/services']));

    fireEvent.click(screen.getByRole('button', { name: 'View Our Partners' }));
    const dialog = await screen.findByRole('dialog', { name: 'Our Trusted Partners' });
    expect(
      within(dialog)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/get-quote']);
  });

  it('emits the same SEO data and JSON-LD as the live page', async () => {
    await renderPage();
    const seo = getSEOData('why-us');
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

  it('states only the checkable facts from companyFacts', async () => {
    await renderPage();
    const hero = screen.getByRole('region', { name: 'Hero' });
    for (const { value, label } of TRUST_FACTS) {
      expect(within(hero).getByText(value)).toBeDefined();
      expect(within(hero).getByText(label)).toBeDefined();
    }
    expect(
      screen.getByText(`FSP ${COMPANY.fspNumber}, granted ${COMPANY.fscaAuthorisedOn}`),
    ).toBeDefined();
    expect(screen.getByText(`${COMPANY.legalName}, ${COMPANY.registrationNumber}`)).toBeDefined();
    expect(screen.getByText(COMPANY.office)).toBeDefined();
    expect(
      screen.getByText(new RegExp(`Authorised by the FSCA \\(FSP ${COMPANY.fspNumber}\\)`)),
    ).toBeDefined();
    // The final call to action repeats the first three facts.
    const cta = screen.getByRole('region', { name: 'Experience the Navigate Wealth Difference' });
    const facts = [...cta.querySelectorAll('dt')].map((dt) => dt.textContent);
    expect(facts).toEqual(TRUST_FACTS.slice(0, 3).map((f) => f.value));
  });

  it('shows the advantage cards and the four steps of the process', async () => {
    await renderPage();
    for (const title of [
      'Truly Independent',
      'Personal Service',
      'Comprehensive Solutions',
      'Security & Compliance',
      'Discovery & Analysis',
      'Strategy Development',
      'Clear Recommendations',
      'Implementation & Support',
    ]) {
      expect(screen.getByRole('heading', { level: 3, name: title })).toBeDefined();
    }
    expect(screen.getByText('LEG 04')).toBeDefined();
    expect(screen.getByText('Q&A session')).toBeDefined();
    expect(screen.getByAltText('Financial planning consultation')).toBeDefined();
  });

  it('turns the compass to each core value, by click, by key and by the arrows', async () => {
    await renderPage();
    const tablist = screen.getByRole('tablist', { name: 'Core values' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'NIndependence',
      'ETransparency',
      'SExpertise',
      'WTechnology',
    ]);
    const panel = screen.getByRole('tabpanel');
    const needle = screen.getByTestId('compass-needle');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs[0].id);
    expect(within(panel).getByRole('heading', { name: 'Independence' })).toBeDefined();
    expect(panel.textContent).toContain('Bearing 000° · N');
    expect(panel.textContent).toContain('01 / 04');
    expect(needle.style.transform).toBe('rotate(0deg)');

    fireEvent.click(tabs[2]);
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(within(panel).getByRole('heading', { name: 'Expertise' })).toBeDefined();
    expect(within(panel).getByText('FSCA Fit and Proper standards')).toBeDefined();
    expect(needle.style.transform).toBe('rotate(180deg)');

    // Roving focus: only the selected tab is in the tab order.
    expect(tabs.map((t) => t.tabIndex)).toEqual([-1, -1, 0, -1]);
    fireEvent.keyDown(tabs[2], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[3]);
    expect(within(panel).getByRole('heading', { name: 'Technology' })).toBeDefined();
    fireEvent.keyDown(tabs[3], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0], { key: 'End' });
    expect(document.activeElement).toBe(tabs[3]);

    const next = within(panel).getByRole('button', { name: 'Next value' });
    next.focus();
    fireEvent.click(next);
    expect(within(panel).getByRole('heading', { name: 'Independence' })).toBeDefined();
    // The card is updated in place, so the button keeps focus.
    expect(document.activeElement).toBe(next);
    fireEvent.click(within(panel).getByRole('button', { name: 'Previous value' }));
    expect(within(panel).getByRole('heading', { name: 'Technology' })).toBeDefined();
    expect(panel.textContent).toContain('04 / 04');
  });

  it('lists every partner by service in a dialog that returns focus', async () => {
    await renderPage();
    const trigger = screen.getByRole('button', { name: 'View Our Partners' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Our Trusted Partners' });
    for (const group of PROVIDER_GROUPS) {
      const heading = within(dialog).getByRole('heading', { name: group.title });
      const section = heading.closest('section')!;
      const items = [...section.querySelectorAll('li')].map((li) => li.textContent);
      expect(items).toEqual(group.providers.map((p) => p.name));
      const n = group.providers.length;
      expect(section.textContent).toContain(`${n} ${n === 1 ? 'partner' : 'partners'}`);
    }
    fireEvent.click(within(dialog).getByText('Close', { selector: 'button' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
