/**
 * The redesigned link-in-bio page, reached the way production reaches it:
 * LinktreePage with the design switch on lazy-loads NavigatorLinktreePage.
 * Covers what the redesign must not lose — the links, bio, custom title,
 * social profiles and branding switch from the same public route, every
 * address kept as published (tracking parameters included), every link in a
 * new tab, the click count, the noindex SEO tags, and the loading, empty and
 * unavailable states — and that neither request sends the anon key as a
 * bearer token.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../utils/supabase/info', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/supabase/info')>()),
  projectId: 'proj',
  publicAnonKey: 'anon',
}));

const { LinktreePage } = await import('../../components/pages/LinktreePage');
const { seoProps } = await import('../../components/pages/linktree/linktreeData');
const { COMPANY } = await import('../../config/companyFacts');
const { WHATSAPP_HREF } = await import('../siteLinks');
const { SITE_ORIGIN } = await import('../../utils/siteOrigin');

const BASE = 'https://proj.supabase.co/functions/v1/make-server-91ed8379/linktree';

const LINKS = [
  {
    id: 'l2',
    title: 'Book a Free Consultation',
    url: 'navigatewealth.co.za/contact?utm_source=instagram&utm_campaign=bio',
    description: 'A free, no-obligation financial planning session',
    enabled: true,
    order: 1,
    clicks: 0,
  },
  {
    id: 'l1',
    title: 'Company Website',
    url: 'https://www.navigatewealth.co/',
    description: 'Visit our official website',
    enabled: true,
    order: 0,
    clicks: 0,
  },
  {
    id: 'l3',
    title: 'Our Instagram',
    url: 'https://www.instagram.com/navigate_wealth?utm_source=linktree',
    enabled: true,
    order: 2,
    clicks: 0,
  },
];

const SETTINGS = {
  title: 'Navigate Wealth',
  bio: 'Independent Financial Advice | FSCA Regulated | FSP 54606',
  theme: 'navy',
  showBranding: true,
  socialProfiles: {
    linkedin: 'https://www.linkedin.com/company/navigatewealth/',
    instagram: 'https://www.instagram.com/navigate_wealth',
    facebook: '',
    email: 'mailto:info@navigatewealth.co',
  },
};

type Reply = { links?: unknown[]; settings?: unknown } | 'error' | 'throw' | 'never';

function stubFetch(reply: Reply = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/click/')) return { ok: true, json: async () => ({ success: true }) };
    if (reply === 'never') return new Promise(() => {});
    if (reply === 'throw') throw new Error('offline');
    if (reply === 'error') return { ok: false, status: 500, json: async () => ({}) };
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: { links: reply.links ?? LINKS, settings: reply.settings ?? SETTINGS },
      }),
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/links']}>
      <LinktreePage />
    </MemoryRouter>,
  );
}

async function renderLoaded() {
  renderPage();
  // The lazy page first, then its request.
  await waitFor(() => expect(document.querySelector('.nw-site.nwlk')).not.toBeNull());
  await waitFor(() => expect(screen.queryByText('Loading links')).toBeNull());
}

/** jsdom does not navigate; keep link clicks from trying. */
const stopNavigation = (event: Event) => event.preventDefault();
beforeEach(() => document.addEventListener('click', stopNavigation));
afterEach(() => {
  document.removeEventListener('click', stopNavigation);
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Navigator links page', () => {
  it('reads the live page’s public route, without the anon key as a bearer', async () => {
    const fetchMock = stubFetch();
    await renderLoaded();
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/public`, {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('emits the live page’s SEO tags, noindex included', async () => {
    stubFetch();
    await renderLoaded();
    expect(document.title).toBe(seoProps.title);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      seoProps.canonicalUrl,
    );
  });

  it('shows the loading state, with the logo as the one H1', async () => {
    stubFetch('never');
    renderPage();
    expect((await screen.findByRole('status')).textContent).toBe('Loading links');
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(within(h1s[0]).getByRole('img').getAttribute('alt')).toBe('Navigate Wealth');
    expect(h1s[0].closest('.nw-site.nwlk')).not.toBeNull();
  });

  it('lists every link in order, as published, each in a new tab', async () => {
    stubFetch();
    await renderLoaded();
    const list = screen.getByText('3 destinations').closest<HTMLElement>('.nwlk-card')!;
    const links = within(list)
      .getAllByRole('link')
      .filter((a) => a.classList.contains('nwlk-link'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      `${SITE_ORIGIN}`,
      `${SITE_ORIGIN}/contact?utm_source=instagram&utm_campaign=bio`,
      'https://www.instagram.com/navigate_wealth?utm_source=linktree',
    ]);
    for (const a of links) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
    expect(links[1].textContent).toContain('www.navigatewealth.co/contact');
    expect(links[1].textContent).toContain('A free, no-obligation financial planning session');
    expect(screen.getByText(SETTINGS.bio)).toBeTruthy();
  });

  it('keeps every social profile that has an address, and the firm’s own contacts', async () => {
    stubFetch();
    await renderLoaded();
    expect(screen.getByRole('link', { name: 'LinkedIn' }).getAttribute('href')).toBe(
      SETTINGS.socialProfiles.linkedin,
    );
    expect(screen.getByRole('link', { name: 'Instagram' }).getAttribute('href')).toBe(
      SETTINGS.socialProfiles.instagram,
    );
    expect(screen.getByRole('link', { name: 'Email' }).getAttribute('href')).toBe(
      SETTINGS.socialProfiles.email,
    );
    expect(screen.queryByRole('link', { name: 'Facebook' })).toBeNull();
    expect(
      screen.getByRole('link', { name: `Call ${COMPANY.phone.display}` }).getAttribute('href'),
    ).toBe(COMPANY.phone.tel);
    expect(
      screen.getByRole('link', { name: 'WhatsApp Navigate Wealth' }).getAttribute('href'),
    ).toBe(WHATSAPP_HREF);
    expect(screen.getByRole('link', { name: `Email ${COMPANY.email}` }).getAttribute('href')).toBe(
      `mailto:${COMPANY.email}`,
    );
    expect(screen.getByText(`FSP ${COMPANY.fspNumber}`)).toBeTruthy();
  });

  it('counts a click on the live route and marks the link while it does', async () => {
    const fetchMock = stubFetch();
    await renderLoaded();
    const link = screen.getByRole('link', { name: /Company Website/ });
    fireEvent.click(link);
    expect(link.classList.contains('nwlk-link-on')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/click/l1`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    });
    await waitFor(() => expect(link.classList.contains('nwlk-link-on')).toBe(false));
  });

  it('signs the page when branding is on, and not when it is off', async () => {
    stubFetch();
    await renderLoaded();
    expect(screen.getByText('Wealthfront (Pty) Ltd | FSP 54606 | FSCA Regulated')).toBeTruthy();
    cleanup();
    stubFetch({ settings: { ...SETTINGS, showBranding: false } });
    await renderLoaded();
    expect(screen.queryByText(/Wealthfront \(Pty\) Ltd/)).toBeNull();
  });

  it('shows a custom page title as the one H1', async () => {
    stubFetch({ settings: { ...SETTINGS, title: 'Shawn on Instagram' } });
    await renderLoaded();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(['Shawn on Instagram']);
  });

  it('shows the empty state when nothing is published', async () => {
    stubFetch({ links: [] });
    await renderLoaded();
    expect(screen.getByText('No links available yet.')).toBeTruthy();
    expect(screen.getByText('Check back soon.')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    // The social profiles stay reachable.
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toBeTruthy();
  });

  it.each(['error', 'throw'] as const)('shows the unavailable state (%s)', async (reply) => {
    stubFetch(reply);
    await renderLoaded();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(['Links unavailable']);
    expect(screen.getByRole('link', { name: /Visit website/ }).getAttribute('href')).toBe(
      SITE_ORIGIN,
    );
  });
});
