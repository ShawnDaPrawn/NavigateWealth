/**
 * The redesigned /design-system page, reached the way production reaches it:
 * DesignSystemPage with the design switch on lazy-loads
 * NavigatorDesignSystemPage. Covers what the redesign must not lose — the live
 * page's eight tabs and its scroll to the tab bar, its copy commands and
 * timing, its back-to-top button and its lack of SEO tags (the route is
 * noindex) — and the board's states: each tab, the filters, the searches and
 * their empty states.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

const copyToClipboard = vi.fn<(text: string) => Promise<void>>();
vi.mock('../../utils/clipboard', () => ({ copyToClipboard: (t: string) => copyToClipboard(t) }));

const DesignSystemPageModule = await import('../../components/pages/DesignSystemPage');
const DesignSystemPage = DesignSystemPageModule.default;

const scrollTo = vi.fn();

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/design-system']}>
      <DesignSystemPage />
    </MemoryRouter>,
  );
  return screen.findByRole('heading', { level: 1 }, { timeout: 5000 });
}

function openTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }));
}

beforeEach(() => {
  copyToClipboard.mockReset().mockResolvedValue(undefined);
  scrollTo.mockReset();
  vi.stubGlobal('scrollTo', scrollTo);
  document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Navigator design system page', () => {
  it("has one H1, the board's heading, and keeps both exports", async () => {
    const h1 = await renderPage();
    expect(h1.textContent).toBe('Navigate Wealth Design System');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h1.closest('.nw-site.nwds')).not.toBeNull();
    expect(DesignSystemPageModule.DesignSystemPage).toBe(DesignSystemPage);
  });

  it('sets no SEO tags, as the live page does (the route is noindex)', async () => {
    await renderPage();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.getElementById('seo-structured-data')).toBeNull();
  });

  it('offers the live page’s eight tabs and opens each one', async () => {
    await renderPage();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Overview',
      'Colours',
      'Typography',
      'Components',
      'Patterns',
      'Icons',
      'Sections',
      'Download',
    ]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tabs[0].id);

    const headings: Record<string, string> = {
      Overview: 'One system, every page',
      Colours: 'Colour',
      Typography: 'Typography',
      Components: 'Components',
      Patterns: 'UI patterns',
      Icons: 'Icons',
      Sections: 'Section templates',
      Download: 'Download resources',
    };
    for (const [tab, heading] of Object.entries(headings)) {
      openTab(tab);
      expect(screen.getByRole('tab', { name: tab }).getAttribute('aria-selected')).toBe('true');
      expect(
        within(screen.getByRole('tabpanel')).getByRole('heading', { level: 2, name: heading }),
      ).toBeTruthy();
    }
    // Choosing a tab scrolls to the tab bar, as the live page's navigateToTab does.
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('moves between tabs with the arrow keys, Home and End', async () => {
    await renderPage();
    const overview = screen.getByRole('tab', { name: 'Overview' });
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Colours' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Colours' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Download' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Download' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('opens a tab from an overview card and from the phone select', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^Icons/ }));
    expect(screen.getByRole('tab', { name: 'Icons' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.change(screen.getByLabelText('Design system section'), {
      target: { value: 'sections' },
    });
    expect(screen.getByRole('tab', { name: 'Sections' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('copies the live CLI commands and reads "Copied" for two seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderPage();
    openTab('Download');
    const button = screen.getByRole('button', { name: 'Copy CLI command: Design Tokens' });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(copyToClipboard).toHaveBeenCalledWith(
      'npx navigate-wealth-cli init --template design-tokens',
    );
    expect(button.textContent).toBe('Copied');
    expect(screen.getByText('Design Tokens CLI command copied.')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(button.textContent).toBe('Copy CLI');
    for (const id of ['ui-components', 'page-templates', 'full-codebase']) {
      expect(screen.getByText(`npx navigate-wealth-cli init --template ${id}`)).toBeTruthy();
    }
    for (const b of screen.getAllByRole('button', { name: 'Download' })) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it('copies a component snippet and an icon name', async () => {
    await renderPage();
    openTab('Components');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy code: Button' }));
    });
    expect(copyToClipboard.mock.calls[0][0]).toContain('class="nw-btn"');
    openTab('Icons');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy icon name shield-check' }));
    });
    expect(copyToClipboard).toHaveBeenLastCalledWith('shield-check');
  });

  it('filters components by category', async () => {
    await renderPage();
    openTab('Components');
    expect(screen.getAllByRole('article')).toHaveLength(13);
    expect(screen.getByText('13 components')).toBeTruthy();
    const overlay = screen.getByRole('button', { name: 'Overlay' });
    fireEvent.click(overlay);
    expect(overlay.getAttribute('aria-pressed')).toBe('true');
    expect(
      screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent),
    ).toEqual(['Dialog / modal', 'Tooltip']);
    expect(screen.getByText('2 components')).toBeTruthy();
  });

  it('searches icons, with the board’s empty state', async () => {
    await renderPage();
    openTab('Icons');
    expect(screen.getByText('40 of 40 icons')).toBeTruthy();
    const search = screen.getByRole('searchbox', { name: 'Search icons' });
    fireEvent.change(search, { target: { value: 'arrow' } });
    expect(screen.getByText('3 of 40 icons')).toBeTruthy();
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('0 of 40 icons')).toBeTruthy();
    expect(screen.getByText('No icons match “zzz”')).toBeTruthy();
  });

  it('searches and filters section templates, with the board’s empty state', async () => {
    await renderPage();
    openTab('Sections');
    expect(screen.getAllByRole('article')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Layouts' }));
    expect(screen.getAllByRole('article')).toHaveLength(4);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search sections' }), {
      target: { value: 'navy' },
    });
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText('No sections found')).toBeTruthy();
  });

  it('links only to real routes and the firm’s own contact details', async () => {
    await renderPage();
    const partner = screen.getByRole('heading', { level: 2, name: /Build the future of/ });
    const band = partner.closest('section')!;
    expect(
      within(band).getByRole('link', { name: 'info@navigatewealth.co' }).getAttribute('href'),
    ).toBe('mailto:info@navigatewealth.co');
    expect(within(band).getByRole('link', { name: '(+27) 12-667-2505' }).getAttribute('href')).toBe(
      'tel:+27126672505',
    );
    expect(
      within(band)
        .getByRole('link', { name: /Discuss a partnership/ })
        .getAttribute('href'),
    ).toBe('/contact');

    openTab('Components');
    expect(
      screen.getByRole('link', { name: 'Book a Free Consultation' }).getAttribute('href'),
    ).toBe('/schedule-consultation');
    expect(screen.getByRole('link', { name: 'Get a Quote' }).getAttribute('href')).toBe(
      '/get-quote',
    );
    const topnav = screen.getByRole('navigation', { name: 'Example top navigation' });
    expect(
      within(topnav)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/', '/services', '/resources', '/contact']);
  });

  it('shows the back-to-top button once the page has scrolled 600px', async () => {
    await renderPage();
    expect(screen.queryByRole('button', { name: 'Back to top' })).toBeNull();
    Object.defineProperty(window, 'scrollY', { value: 700, configurable: true });
    fireEvent.scroll(window);
    const top = await screen.findByRole('button', { name: 'Back to top' });
    fireEvent.click(top);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    fireEvent.scroll(window);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Back to top' })).toBeNull());
  });
});
