/**
 * The redesigned press page, reached the way production reaches it: PressPage
 * with the design switch on lazy-loads NavigatorPressPage. Covers what the
 * redesign must not lose (the SEO data, the links, the company facts, the
 * press articles from the same route, the media-kit request) and what it adds
 * (a boilerplate that really copies, keyboard tabs, focus returned to the
 * button that opened the dialog). It also holds the page to companyFacts.ts:
 * no figure about the firm that is not listed there.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));

const { PressPage } = await import('../../components/pages/PressPage');
const { COMPANY, FOUNDER } = await import('../../config/companyFacts');
const { getSEOData } = await import('../../components/seo/seo-config');

const ARTICLES = [
  {
    id: '1',
    title: 'Navigate Wealth opens its Pretoria office',
    slug: 'pretoria-office',
    excerpt: 'A new home on Sovereign Drive.',
    press_category: 'company_news',
    published_at: '2026-10-12T08:00:00Z',
    reading_time_minutes: 3,
  },
  {
    id: '2',
    title: 'Reading the 2026 budget',
    slug: 'budget-2026',
    excerpt: 'What changes for retirement savers.',
    press_category: 'industry_insights',
    published_at: '2026-09-02T08:00:00Z',
  },
];

function stubFetch(body: unknown = { success: true, data: [] }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => body })),
  );
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/press']}>
      <PressPage />
    </MemoryRouter>,
  );
  const h1 = await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(screen.queryByText(/Loading press releases/)).toBeNull());
  return h1;
}

/** jsdom has no clipboard; give navigator one for a test. */
function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

function hrefs() {
  return new Set(screen.getAllByRole('link').map((a) => a.getAttribute('href')));
}

beforeEach(() => stubFetch());
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, 'clipboard');
  window.getSelection()?.removeAllRanges();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator press page', () => {
  it("has one H1: the board's heading", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Navigate Wealth Press Centre');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    // The redesign, not the legacy page, which shares the heading's words.
    expect(h1.closest('.nw-site.nwpr2')).not.toBeNull();
  });

  it('emits the live page’s SEO data', async () => {
    await renderPage();
    const seo = getSEOData('press');
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    const data = JSON.parse(document.getElementById('seo-structured-data')!.textContent!);
    expect(data).toMatchObject({
      '@type': 'WebPage',
      name: seo.title,
      description: seo.description,
      url: seo.canonicalUrl,
    });
    expect(document.title).toBe(seo.title);
  });

  it('reads the press articles from the live page’s route', async () => {
    await renderPage();
    // A public route: no Authorization header, so no anon key posing as one.
    expect(fetch).toHaveBeenCalledWith(
      'https://proj.supabase.co/functions/v1/make-server-91ed8379/publications/press/articles',
    );
  });

  it('links only to routes the site serves, its own sections and the firm’s contacts', async () => {
    await renderPage();
    expect(hrefs()).toEqual(
      new Set([
        '#media-contact',
        '/contact',
        `mailto:${COMPANY.email}`,
        COMPANY.phone.tel,
        'https://www.navigatewealth.co',
      ]),
    );
    expect(document.getElementById('media-contact')).not.toBeNull();
  });

  it('states only facts from companyFacts.ts', async () => {
    await renderPage();
    const facts = screen.getByRole('region', { name: 'Company facts' });
    for (const text of [
      COMPANY.fspNumber,
      COMPANY.fscaAuthorisedOn,
      String(COMPANY.foundedYear),
      'Founder-led',
      `Led by ${FOUNDER.name}`,
    ]) {
      expect(within(facts).getByText(text)).toBeDefined();
    }

    const quote = document.querySelector('blockquote')!;
    expect(quote.textContent).toBe(
      'Navigate Wealth is the trading name of Wealthfront (Pty) Ltd (registration 2024/071953/07), an independent, founder-led financial advisory practice and an authorised Financial Services Provider (FSP 54606) licensed by the Financial Sector Conduct Authority (FSCA) on 4 February 2025. Founded in 2024 by Shawn Francisco and based in Pretoria, Navigate Wealth helps individuals and families build, protect, and transfer wealth through comprehensive financial planning and investment management.',
    );

    const info = screen.getByRole('heading', { name: 'Company Information' }).parentElement!;
    const rows = [...info.querySelectorAll('dl > div')].map((row) => [
      row.querySelector('dt')!.textContent,
      row.querySelector('dd')!.textContent,
    ]);
    expect(rows).toEqual([
      ['Legal entity', COMPANY.legalName],
      ['Founder', FOUNDER.name],
      ['Founded', String(COMPANY.foundedYear)],
      ['FSCA authorised', COMPANY.fscaAuthorisedOn],
      ['Headquarters', COMPANY.headquarters],
      ['FSP Licence', COMPANY.fspNumber],
      ['Website', 'www.navigatewealth.co'],
    ]);

    // The kinds of claim the October 2026 review found: none may appear.
    const text = document.body.textContent!;
    expect(text).not.toMatch(/\d+\+|years of experience|clients|team members|award-winning/i);
    expect(screen.queryByRole('tab', { name: 'Awards' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Team News' })).toBeNull();
  });

  it('shows the board’s sections in order', async () => {
    await renderPage();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'About Navigate Wealth',
      'Featured News',
      'Media Resources',
      'Media Contact',
    ]);
    for (const label of ['01 — Boilerplate', '02 — Newsroom', '03 — Media Kit', '04 — Contact']) {
      expect(screen.getByText(label)).toBeDefined();
    }
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'No News Available',
      'Brand Assets',
      'Founder Photos',
      'Company Fact Sheet',
      'Product Brochures',
      'Press Enquiries',
      'Company Information',
    ]);
  });

  it('gives every image an alt: the logos described, the card pictures decorative', async () => {
    await renderPage();
    const alts = [...document.querySelectorAll('img')].map((img) => img.getAttribute('alt'));
    expect(alts).toEqual([
      'Navigate Wealth logo with sail mark',
      'Navigate Wealth logo, reversed for dark backgrounds',
      'Navigate Wealth sail mark',
      '',
      '',
    ]);
    const founder = document.querySelector('.nwpr2-asset-photo')!;
    expect(founder.closest('picture')!.querySelector('source')!.getAttribute('srcset')).toContain(
      FOUNDER.imageKey,
    );
  });
});

describe('Navigator press newsroom', () => {
  it('with nothing published, says so and offers the contact page', async () => {
    await renderPage();
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getByRole('heading', { name: 'No News Available' })).toBeDefined();
    expect(
      within(panel)
        .getByRole('link', { name: /Contact Us/ })
        .getAttribute('href'),
    ).toBe('/contact');
  });

  it('lists published releases and filters them by tab and by search', async () => {
    stubFetch({ success: true, data: ARTICLES });
    await renderPage();
    const panel = screen.getByRole('tabpanel');
    expect(
      within(panel)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/resources/article/pretoria-office', '/resources/article/budget-2026']);
    expect(panel.textContent).toContain('12 Oct 2026');
    expect(panel.textContent).toContain('Company News');

    fireEvent.click(screen.getByRole('tab', { name: 'Industry Insights' }));
    expect(within(panel).getAllByRole('link')).toHaveLength(1);
    expect(within(panel).getByText('Reading the 2026 budget')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'Product Launch' }));
    expect(within(panel).getByRole('heading', { name: 'No Matching Results' })).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'All' }));
    fireEvent.change(screen.getByLabelText('Search press releases'), {
      target: { value: 'sovereign' },
    });
    expect(
      within(panel)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/resources/article/pretoria-office']);
  });

  it('moves between the tabs with the arrow keys, Home and End', async () => {
    await renderPage();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'All',
      'Company News',
      'Product Launch',
      'Industry Insights',
    ]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1, -1]);
    tabs[0].focus();
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tabs[1].id);
    fireEvent.keyDown(tabs[1], { key: 'End' });
    expect(document.activeElement).toBe(tabs[3]);
    fireEvent.keyDown(tabs[3], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tabs[3]);
    fireEvent.keyDown(tabs[3], { key: 'Home' });
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('treats a failed request as nothing published', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await renderPage();
    expect(screen.getByRole('heading', { name: 'No News Available' })).toBeDefined();
  });
});

describe('Navigator press boilerplate', () => {
  it('copies the boilerplate and says so', async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy boilerplate' }));
    });
    expect(writeText).toHaveBeenCalledWith(document.querySelector('blockquote')!.textContent);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('Boilerplate copied to the clipboard');
  });

  it('selects the text instead when the clipboard is refused', async () => {
    stubClipboard(
      vi.fn(async () => {
        throw new Error('denied');
      }),
    );
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy boilerplate' }));
    });
    expect(screen.getByRole('button', { name: 'Copy boilerplate' })).toBeDefined();
    expect(window.getSelection()!.toString()).toBe(
      document.querySelector('blockquote')!.textContent,
    );
  });
});

describe('Navigator press media-kit request', () => {
  it('opens from the hero with the live modal’s email link, and returns focus', async () => {
    await renderPage();
    const trigger = screen.getByRole('button', { name: /Request Media Kit/ });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Request Media Materials' });
    expect(
      within(dialog)
        .getByRole('link', { name: /Email Your Request/ })
        .getAttribute('href'),
    ).toBe('mailto:info@navigatewealth.co?subject=Media%20kit%20request');
    expect(dialog.textContent).toContain(COMPANY.email);
    expect(dialog.textContent).toContain(COMPANY.phone.display);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('opens from each media-kit card and returns focus to that card’s button', async () => {
    await renderPage();
    const buttons = [
      'Brand Assets',
      'Founder Photos',
      'Company Fact Sheet',
      'Product Brochures',
    ].map((title) => screen.getByRole('button', { name: `Request ${title}` }));
    const trigger = buttons[2];
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Request Media Materials' });
    // The dialog has two: the corner X and the "Close" beside the email link.
    const [, closeButton] = within(dialog).getAllByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
