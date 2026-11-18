/**
 * The redesigned Team page through the design switch, checked against the live
 * page: same SEO, same team feed, the founder always shown from companyFacts,
 * no invented team, credentials only from companyFacts, every live link kept.
 */
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));
vi.mock('../../components/shared/OptimizedImage', () => ({
  OptimizedImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const { TeamPage } = await import('../../app/publicPages');
const { TeamPage: LiveTeamPage } = await import('../../components/pages/TeamPage');

const MEMBER = {
  id: 'm1',
  name: 'Ayanda Nkosi',
  title: 'Paraplanner',
  credentials: '',
  bio: 'Prepares the analysis behind every recommendation.',
  specialties: ['Retirement'],
  image: 'https://example.com/ayanda.jpg',
  linkedinUrl: 'https://www.linkedin.com/in/ayanda',
  sortOrder: 1,
};

function respond(data: unknown[]) {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data }),
  } as Response);
}

async function renderNavigator() {
  render(
    <MemoryRouter initialEntries={['/team']}>
      <Suspense fallback={null}>
        <TeamPage />
      </Suspense>
    </MemoryRouter>,
  );
  const h1 = await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(screen.queryByText(/Loading team members/)).toBeNull());
  return h1;
}

function hrefs(root: ParentNode = document): Set<string> {
  return new Set([...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''));
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  respond([]);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator Team page', () => {
  it('has one descriptive H1 and the same SEO as the live page', async () => {
    render(
      <MemoryRouter>
        <LiveTeamPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const liveJsonLd = document.getElementById('seo-structured-data')?.textContent;
    const liveTitle = document.title;
    cleanup();
    document.getElementById('seo-structured-data')?.remove();

    const h1 = await renderNavigator();
    expect(h1.textContent).toBe('Meet the Founder of Navigate Wealth');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe(liveTitle);
    expect(document.getElementById('seo-structured-data')?.textContent).toBe(liveJsonLd);
  });

  it('reads the same team feed as the live page', async () => {
    await renderNavigator();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      'https://proj.supabase.co/functions/v1/make-server-91ed8379/publications/team',
    );
    expect(vi.mocked(fetch).mock.calls[0][1]).toEqual({
      headers: { Authorization: 'Bearer anon' },
    });
  });

  it('keeps every live link target and adds only routes the site serves', async () => {
    const { container } = render(
      <MemoryRouter>
        <LiveTeamPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const live = hrefs(container);
    cleanup();
    await renderNavigator();
    const nav = hrefs();
    for (const target of live) expect(nav.has(target)).toBe(true);
    expect(nav).toEqual(
      new Set([
        '/about#founder',
        '/contact',
        '/schedule-consultation',
        'mailto:info@navigatewealth.co',
        'tel:+27126672505',
      ]),
    );
  });

  it('always shows the founder from companyFacts, with only the credentials recorded there', async () => {
    await renderNavigator();
    expect(screen.getByRole('heading', { level: 2, name: 'Shawn Francisco' })).toBeDefined();
    expect(screen.getByAltText('Shawn Francisco, Founder of Navigate Wealth')).toBeDefined();
    const working = screen.getByRole('complementary', { name: 'Working with Shawn' });
    expect(within(working).getByText('FSP 54606 · FSCA, 4 February 2025')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Our Team' })).toBeNull();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/experienced team/i);
    // The owner-confirmed qualifications (companyFacts FOUNDER.qualifications)
    // appear; nothing beyond them does.
    const quals = screen.getByRole('list', { name: "Shawn Francisco's qualifications" });
    expect(within(quals).getByText('RE1')).toBeDefined();
    expect(within(quals).getByText('RE5')).toBeDefined();
    expect(within(quals).getByText('Higher Diploma in Wealth Management')).toBeDefined();
    expect(within(quals).getByText('All obtained through Moonstone')).toBeDefined();
    expect(text).not.toMatch(/CFP|CFA|CA\(SA\)|Certified Financial Planner/);
    expect(text).not.toMatch(/\d+\+/);
  });

  it('still shows the founder when the feed fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValue(new Error('network'));
    await renderNavigator();
    expect(screen.getByRole('heading', { level: 2, name: 'Shawn Francisco' })).toBeDefined();
  });

  it('lists published members below the founder, without repeating him', async () => {
    respond([{ ...MEMBER, id: 'f', name: 'Shawn Francisco' }, MEMBER]);
    await renderNavigator();
    const team = screen.getByRole('region', { name: 'Our Team' });
    const cards = within(team)
      .getAllByRole('listitem')
      .filter((li) => li.querySelector('h3'));
    expect(cards).toHaveLength(1);
    expect(within(team).getByRole('heading', { level: 3, name: 'Ayanda Nkosi' })).toBeDefined();
    expect(within(team).getByAltText('Ayanda Nkosi')).toBeDefined();
    expect(
      within(team).getByRole('link', { name: 'Ayanda Nkosi on LinkedIn' }).getAttribute('href'),
    ).toBe('https://www.linkedin.com/in/ayanda');
    // No email on the record, so no inert email button.
    expect(within(team).queryByRole('link', { name: /Email/ })).toBeNull();
    expect(screen.getAllByRole('heading', { name: 'Shawn Francisco' })).toHaveLength(1);
    // "How We Work" moves to 03 when a team section is shown.
    expect(screen.getByText('03 — Approach')).toBeDefined();
  });
});
