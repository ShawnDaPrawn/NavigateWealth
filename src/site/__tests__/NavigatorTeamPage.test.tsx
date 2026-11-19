/**
 * The redesigned Team page, reached the way production reaches it: TeamPage
 * with the design switch on lazy-loads NavigatorTeamPage. Covers what the
 * redesign must not lose — the founder and his note from companyFacts, anyone
 * published through the admin Team manager (never the founder twice), the
 * live page's SEO tags and WebPage JSON-LD — and that every link goes to a
 * route the site serves and every fact comes from companyFacts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));

const { TeamPage } = await import('../../components/pages/TeamPage');
const { getSEOData } = await import('../../components/seo/seo-config');
const { createWebPageSchema } = await import('../../components/seo/SEO');
const { COMPANY, FOUNDER } = await import('../../config/companyFacts');

/** Public routes in src/app/AppRoutes.tsx that this page may link to. */
const SERVED_ROUTES = new Set(['/about', '/contact', '/schedule-consultation']);

function stubTeam(data: unknown[] | Error = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (data instanceof Error) throw data;
      return { ok: true, json: async () => ({ success: true, data }) };
    }),
  );
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/team']}>
      <TeamPage />
    </MemoryRouter>,
  );
  const h1 = await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  return h1;
}

beforeEach(() => stubTeam());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator Team page', () => {
  it("has one H1, the board's heading", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Meet Our Founder');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('keeps headings in order: the H1, then the two sections, then the waypoints', async () => {
    await renderPage();
    const outline = screen
      .getAllByRole('heading')
      .map((h) => `${h.tagName}:${h.textContent?.trim()}`);
    expect(outline).toEqual([
      'H1:Meet Our Founder',
      'H2:Shawn Francisco',
      'H2:How We Work',
      'H3:Direct Access',
      'H3:Continuous Education',
      'H3:Client-Centric Focus',
    ]);
  });

  it('links only to routes the site already serves', async () => {
    await renderPage();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');
    expect(new Set(hrefs)).toEqual(
      new Set([
        '/schedule-consultation',
        '/about#founder',
        '/contact',
        `mailto:${COMPANY.email}`,
        COMPANY.phone.tel,
      ]),
    );
    for (const href of hrefs.filter((h) => h.startsWith('/'))) {
      expect(SERVED_ROUTES.has(href.split('#')[0])).toBe(true);
    }
  });

  it('emits the live page’s SEO tags and WebPage JSON-LD', async () => {
    await renderPage();
    const seo = getSEOData('team');
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

  it('shows the founder, his note and the facts, all from companyFacts', async () => {
    await renderPage();
    const hero = screen.getByRole('region', { name: 'Hero' });
    expect(
      within(hero).getByText(
        `${COMPANY.tradingName} is a founder-led practice. ${FOUNDER.name} founded the firm in ${COMPANY.foundedYear} and works with clients directly.`,
      ),
    ).toBeDefined();
    for (const fact of [`FSP ${COMPANY.fspNumber}`, 'FSCA-authorised', 'Est. 2024']) {
      expect(within(hero).getAllByText(fact).length).toBeGreaterThan(0);
    }
    expect(within(hero).getByText(COMPANY.headquarters)).toBeDefined();
    const portrait = within(hero).getByAltText(`${FOUNDER.name}, Founder of Navigate Wealth`);
    expect(portrait.getAttribute('fetchpriority')).toBe('high');
    expect(
      portrait
        .closest('picture')!
        .querySelector('source[type="image/avif"]')!
        .getAttribute('srcset'),
    ).toContain(FOUNDER.imageKey);

    const profile = screen.getByRole('region', { name: FOUNDER.name });
    expect(within(profile).getByText(FOUNDER.note[0])).toBeDefined();
    expect(within(profile).getByText(FOUNDER.note[1])).toBeDefined();
    // The note continues on the About page; the Team page shows the first two paragraphs.
    expect(within(profile).queryByText(FOUNDER.note[2])).toBeNull();

    const card = screen.getByRole('complementary', { name: 'Working with the founder' });
    expect(within(card).getByText('Working with Shawn')).toBeDefined();
    expect(within(card).getByText('Free initial consultation')).toBeDefined();
    const rows = [...card.querySelectorAll('dl > div')].map((row) => [
      row.querySelector('dt')!.textContent,
      row.querySelector('dd')!.textContent,
    ]);
    expect(rows).toEqual([
      ['Practice', 'Founder-led, independent'],
      ['Licence', `FSP ${COMPANY.fspNumber} · FSCA, ${COMPANY.fscaAuthorisedOn}`],
      ['Meetings', 'In person, virtual or telephonic'],
      ['Office', COMPANY.office],
      ['Languages', 'English, Afrikaans'],
    ]);
    expect(within(card).getByRole('link', { name: /Email/ }).getAttribute('href')).toBe(
      `mailto:${COMPANY.email}`,
    );
    expect(
      within(card)
        .getByRole('link', { name: /012 667 2505/ })
        .getAttribute('href'),
    ).toBe(COMPANY.phone.tel);
  });

  it('claims no team, headcount or experience it cannot show', async () => {
    await renderPage();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/experienced team|years of experience|\d+\+/i);
    expect(screen.queryByRole('heading', { name: 'Team members' })).toBeNull();
    expect(screen.queryByText(/admin Team manager/)).toBeNull();
  });

  it('still shows the founder when the team request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubTeam(new Error('network'));
    await renderPage();
    expect(screen.getByRole('heading', { name: FOUNDER.name, level: 2 })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Team members' })).toBeNull();
  });

  it('shows published team members below the founder, never the founder twice', async () => {
    stubTeam([
      {
        id: 'founder-dup',
        name: 'Shawn Francisco',
        title: 'Founder',
        credentials: '',
        bio: 'Duplicate of the static founder profile.',
        specialties: [],
        image: '',
        sortOrder: 0,
      },
      {
        id: 'real-1',
        name: 'Thabo Mokoena',
        title: 'Financial Adviser',
        credentials: 'CFP®',
        bio: 'Independent advice for South African families.',
        specialties: ['Retirement Planning', 'Estate Planning'],
        image: '/team/thabo.jpg',
        linkedinUrl: 'https://www.linkedin.com/in/thabo',
        sortOrder: 1,
      },
    ]);
    await renderPage();
    const heading = await screen.findByRole('heading', { name: 'Team members', level: 2 });
    const list = heading.parentElement!.querySelector('ul')!;
    const cards = within(list).getAllByRole('article');
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(within(card).getByRole('heading', { name: 'Thabo Mokoena', level: 3 })).toBeDefined();
    expect(within(card).getByText('Financial Adviser')).toBeDefined();
    expect(within(card).getByText('CFP®')).toBeDefined();
    expect(within(card).getByAltText('Thabo Mokoena').getAttribute('src')).toBe('/team/thabo.jpg');
    expect(
      within(within(card).getByRole('list', { name: 'Specialties' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Retirement Planning', 'Estate Planning']);
    const linkedin = within(card).getByRole('link', { name: /Thabo Mokoena on LinkedIn/ });
    expect(linkedin.getAttribute('href')).toBe('https://www.linkedin.com/in/thabo');
    expect(linkedin.getAttribute('rel')).toContain('noopener');
    // No address of their own: the firm's one public mailbox.
    expect(
      within(card).getByRole('link', { name: 'Email Thabo Mokoena' }).getAttribute('href'),
    ).toBe(`mailto:${COMPANY.email}`);

    expect(screen.getAllByRole('heading', { name: 'Shawn Francisco' })).toHaveLength(1);
    expect(screen.queryByText('Duplicate of the static founder profile.')).toBeNull();
  });
});
