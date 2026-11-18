/**
 * The redesigned /services page through the design switch. It must keep the
 * live page's SEO tags, every service with its highlights, every "Learn more"
 * and quote route, and the consultation action — which the live page opened
 * as a pop-up and the redesign, like the service pages, sends to the
 * consultation page (that page runs the same ConsultationModal flow).
 */
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const { ServicesPage } = await import('../../app/publicPages');
const { ServicesPage: LiveServicesPage } = await import('../../components/pages/ServicesPage');
const { SERVICES } = await import('../../components/pages/servicesPageData');

async function renderNavigator() {
  render(
    <MemoryRouter initialEntries={['/services']}>
      <Suspense fallback={null}>
        <ServicesPage />
      </Suspense>
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

function hrefs(): Set<string> {
  return new Set(
    [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''),
  );
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Navigator services page', () => {
  it('leads with the searched-for phrase as the only H1, the live headline beneath it', async () => {
    const h1 = await renderNavigator();
    expect(h1.textContent).toBe('Financial Advice and Wealth Management Services');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/Financial Solutions for/).textContent).toBe(
      'Financial Solutions for Every Stage of Life',
    );
  });

  it('sets the same title and canonical URL as the live page', async () => {
    render(
      <MemoryRouter>
        <LiveServicesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.title).toBe('Our Services | Navigate Wealth'));
    const liveCanonical = document.querySelector('link[rel="canonical"]')!.getAttribute('href');
    const liveDescription = document
      .querySelector('meta[name="description"]')!
      .getAttribute('content');
    cleanup();
    document.title = '';

    await renderNavigator();
    await waitFor(() => expect(document.title).toBe('Our Services | Navigate Wealth'));
    expect(document.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(
      liveCanonical,
    );
    expect(document.querySelector('meta[name="description"]')!.getAttribute('content')).toBe(
      liveDescription,
    );
  });

  it('keeps every link the live page has, and adds only existing routes', async () => {
    render(
      <MemoryRouter>
        <LiveServicesPage />
      </MemoryRouter>,
    );
    const live = hrefs();
    cleanup();

    await renderNavigator();
    const nav = hrefs();
    for (const target of live) expect(nav, `missing ${target}`).toContain(target);
    const quoteRoutes = SERVICES.filter((s) => s.id !== 'financial-planning').map(
      (s) => `/get-quote/${s.quoteSlug}/contact`,
    );
    expect(nav).toEqual(
      new Set([
        '/get-quote',
        '/schedule-consultation',
        ...SERVICES.map((s) => `#${s.id}`),
        ...SERVICES.map((s) => s.path),
        ...quoteRoutes,
        'tel:+27126672505',
        'mailto:info@navigatewealth.co',
      ]),
    );
  });

  it('lists every service with all its highlights, its page and its quote route', async () => {
    await renderNavigator();
    for (const service of SERVICES) {
      const row = document.getElementById(service.id)!;
      expect(row).not.toBeNull();
      const heading = within(row).getByRole('heading', { level: 3 });
      expect(within(heading).getByRole('link').getAttribute('href')).toBe(service.path);
      expect(within(row).getAllByRole('listitem')).toHaveLength(service.highlights.length);
      const action = within(row).getByRole('link', { name: /(Get Quote|Book Consult) for/ });
      expect(action.getAttribute('href')).toBe(
        service.id === 'financial-planning'
          ? '/schedule-consultation'
          : `/get-quote/${service.quoteSlug}/contact`,
      );
    }
    const index = screen.getByRole('navigation', { name: 'Service index' });
    expect(
      within(index)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(SERVICES.map((s) => `#${s.id}`));
  });

  it('offers the consultation where the live page opened its pop-up', async () => {
    await renderNavigator();
    expect(screen.getByRole('link', { name: 'Book a Consultation' }).getAttribute('href')).toBe(
      '/schedule-consultation',
    );
    expect(screen.getByRole('link', { name: /Schedule Consultation/ }).getAttribute('href')).toBe(
      '/schedule-consultation',
    );
    expect(screen.getAllByRole('link', { name: /Get a Free Quote/ })).toHaveLength(2);
  });
});
