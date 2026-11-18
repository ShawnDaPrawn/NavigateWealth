/**
 * The redesigned About page, reached through the design switch the way a
 * Navigator build reaches it, checked against the live page rendered in the
 * same test: the same SEO tags and JSON-LD, the same link targets, the same
 * modals; plus what the redesign adds (search-led H1, WAI-ARIA tabs whose
 * panels all stay in the document).
 */
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));
vi.mock('../../components/modals/ConsultationModal', () => ({
  ConsultationModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">ConsultationModal</div> : null,
}));
vi.mock('../../components/modals/ProvidersModal', () => ({
  ProvidersModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">ProvidersModal</div> : null,
}));
vi.mock('../../components/modals/ThankYouModal', () => ({ ThankYouModal: () => null }));

const { AboutPage } = await import('../../app/publicPages');
const { AboutPage: LiveAboutPage } = await import('../../components/pages/AboutPage');

async function renderNavigator(path = '/about') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Suspense fallback={null}>
        <AboutPage />
      </Suspense>
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 });
}

function hrefs(root: ParentNode = document): Set<string> {
  return new Set([...root.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? ''));
}

function head() {
  return {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    jsonLd: document.getElementById('seo-structured-data')?.textContent,
  };
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.getElementById('seo-structured-data')?.remove();
});

describe('Navigator About page', () => {
  it('leads with the searched-for H1, the live headline beneath it', async () => {
    const h1 = await renderNavigator();
    expect(h1.textContent).toBe('Independent Financial Advisors, Founded in Pretoria');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Your Trusted Financial Partner')).toBeDefined();
    expect(document.querySelector('.nw-site.nwx-about')).not.toBeNull();
  });

  it('emits the same SEO tags and structured data as the live page', async () => {
    render(
      <MemoryRouter>
        <LiveAboutPage />
      </MemoryRouter>,
    );
    const live = head();
    cleanup();
    document.getElementById('seo-structured-data')?.remove();
    await renderNavigator();
    expect(head()).toEqual(live);
    expect(live.jsonLd).toContain('AboutPage');
  });

  it('links to every target the live page links to, and nowhere new', async () => {
    const { container } = render(
      <MemoryRouter>
        <LiveAboutPage />
      </MemoryRouter>,
    );
    const live = hrefs(container);
    cleanup();
    await renderNavigator();
    // The live page renders /legal only while its Licensing tab is open; here
    // every tab panel stays in the document, so /legal is always present.
    for (const target of live) expect(hrefs().has(target)).toBe(true);
    expect(hrefs()).toEqual(new Set(['/legal', '/careers', '/press']));
  });

  it('reads every licensing fact from companyFacts and states no unbacked figures', async () => {
    await renderNavigator();
    const register = screen.getByRole('complementary', { name: 'On the register' });
    for (const fact of [
      'Wealthfront (Pty) Ltd',
      '2024/071953/07',
      '54606',
      '4 February 2025 · FSCA',
      'Route 21 Business Park, Pretoria',
      'English, Afrikaans',
    ]) {
      expect(within(register).getByText(fact)).toBeDefined();
    }
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/years (of )?combined experience/i);
    expect(text).not.toMatch(/\d+\+ clients/i);
    expect(text).not.toMatch(/\d+% (client )?retention/i);
    expect(text).not.toMatch(/What Our Clients Say/);
    expect(text).not.toMatch(/RE5|Moonstone|Higher Diploma/);
  });

  it('keeps every topic in the document and follows the tabs pattern', async () => {
    await renderNavigator();
    const tabs = within(
      screen.getByRole('tablist', { name: 'About Navigate Wealth' }),
    ).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      '01Mission & Culture',
      '02Our Partners',
      '03Licensing',
      '04Radical Transparency',
    ]);
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')!)!);
    expect(panels.map((p) => p.hidden)).toEqual([false, true, true, true]);
    expect(panels[3].textContent).toContain('Performance Transparency');

    fireEvent.keyDown(tabs[0], { key: 'ArrowDown' });
    expect(panels.map((p) => p.hidden)).toEqual([true, false, true, true]);
    expect(document.activeElement).toBe(tabs[1]);
    fireEvent.keyDown(tabs[1], { key: 'End' });
    expect(panels[3].hidden).toBe(false);
    fireEvent.keyDown(tabs[3], { key: 'ArrowRight' });
    expect(panels[0].hidden).toBe(false);
    expect(tabs[0].getAttribute('tabindex')).toBe('0');
    expect(tabs[1].getAttribute('tabindex')).toBe('-1');
  });

  it('opens the same modals the live page opens', async () => {
    await renderNavigator();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Consultation' }));
    expect(screen.getByText('ConsultationModal')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: /Our Partners/ }));
    fireEvent.click(screen.getByRole('button', { name: /View Our Partners/ }));
    expect(screen.getByText('ProvidersModal')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: /Licensing/ }));
    const licensing = screen.getByRole('tabpanel', { name: /Licensing/ });
    expect(within(licensing).getByRole('link', { name: /Legal Information/ })).toBeDefined();
  });

  it('carries the founder note and scrolls to it, also from /about#founder', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    await renderNavigator('/about#founder');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    const founder = document.getElementById('founder')!;
    expect(within(founder).getByRole('heading', { name: 'A Note From Our Founder' })).toBeDefined();
    expect(
      within(founder).getByAltText('Shawn Francisco, Founder of Navigate Wealth'),
    ).toBeDefined();
    expect(founder.textContent).toContain('FSP 54606');
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Meet Our Founder/ }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    fireEvent.click(within(founder).getByRole('button', { name: /Book a Consultation/ }));
    expect(screen.getByText('ConsultationModal')).toBeDefined();
  });
});
