/**
 * The Navigator Why Us page, reached through the design switch. Covers what
 * the redesign must not lose against the live page rendered in the same test
 * (copy, links, the consultation and partner dialogs, SEO) and the compass of
 * core values (WAI-ARIA tabs, every panel kept in the document).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Suspense, type ComponentType } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../design', () => ({ SITE_DESIGN: 'navigator', resolveSiteDesign: () => 'navigator' }));

// jsdom has no element scrolling.
Element.prototype.scrollTo = () => {};

const { WhyUsPage: SwitchedWhyUsPage } = await import('../../app/publicPages');
const { WhyUsPage: LiveWhyUsPage } = await import('../../components/pages/WhyUsPage');
const { PROVIDER_GROUPS } = await import('../../components/modals/providerGroups');

afterEach(() => {
  cleanup();
  document.getElementById('seo-structured-data')?.remove();
});

function renderAt(Page: ComponentType) {
  return render(
    <MemoryRouter initialEntries={['/why-us']}>
      <Suspense fallback={null}>
        <Page />
      </Suspense>
    </MemoryRouter>,
  );
}

const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

async function renderNavigator() {
  const view = renderAt(SwitchedWhyUsPage);
  await screen.findByRole('heading', { level: 1 });
  return view;
}

describe('Navigator Why Us page', () => {
  it('leads with the searched-for phrase, the live headline beneath it', async () => {
    await renderNavigator();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(norm(h1.textContent)).toBe('Why Choose an Independent Financial Advisor');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByText('Why Choose Navigate Wealth?').tagName).toBe('P');
  });

  it('keeps every live link target and the live copy', async () => {
    const live = renderAt(LiveWhyUsPage);
    const liveLinks = [...live.container.querySelectorAll('a[href]')].map((a) =>
      a.getAttribute('href'),
    );
    const liveCopy = [...live.container.querySelectorAll('h2, h3, h4, p')]
      .map((el) => norm(el.textContent))
      .filter(Boolean);
    live.unmount();

    const { container } = await renderNavigator();
    const links = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    expect(new Set(links)).toEqual(new Set(['/services']));
    for (const link of liveLinks) expect(links).toContain(link);
    const text = norm(container.textContent);
    for (const line of liveCopy) expect(text, `missing copy: ${line}`).toContain(line);
  });

  it('shows one core value at a time, with every value in the document', async () => {
    await renderNavigator();
    const tablist = screen.getByRole('tablist', { name: 'Core values' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs.map((t) => norm(t.textContent))).toEqual([
      'NIndependence',
      'ETransparency',
      'SExpertise',
      'WTechnology',
    ]);
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')!)!);
    expect(panels.map((p) => p.hidden)).toEqual([false, true, true, true]);
    expect(panels[3].textContent).toContain('24/7 online portal access');

    fireEvent.click(tabs[2]);
    expect(panels.map((p) => p.hidden)).toEqual([true, true, false, true]);
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(tabs[2].tabIndex).toBe(0);
    expect(tabs[0].tabIndex).toBe(-1);

    fireEvent.keyDown(tabs[2], { key: 'ArrowRight' });
    expect(panels[3].hidden).toBe(false);
    expect(document.activeElement).toBe(tabs[3]);
    fireEvent.keyDown(tabs[3], { key: 'ArrowRight' });
    expect(panels[0].hidden).toBe(false);
    fireEvent.keyDown(tabs[0], { key: 'End' });
    expect(panels[3].hidden).toBe(false);
    fireEvent.keyDown(tabs[3], { key: 'Home' });
    expect(panels[0].hidden).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Previous value' }));
    expect(panels[3].hidden).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Next value' }));
    expect(panels[0].hidden).toBe(false);
  });

  it('opens the live consultation dialog from each booking button', async () => {
    await renderNavigator();
    const buttons = screen.getAllByRole('button', { name: /Schedule Free Consultation/ });
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      fireEvent.click(button);
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('button', { name: /Continue/ })).toBeDefined();
      fireEvent.keyDown(dialog, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
  });

  it('lists the whole partner roster and returns focus on close', async () => {
    await renderNavigator();
    const trigger = screen.getByRole('button', { name: /View Our Partners/ });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Our Trusted Partners' });
    for (const group of PROVIDER_GROUPS) {
      const section = within(dialog).getByRole('region', { name: group.title });
      for (const p of group.providers) expect(within(section).getByText(p.name)).toBeDefined();
    }
    expect(
      within(dialog)
        .getByRole('link', { name: /Get a Quote/ })
        .getAttribute('href'),
    ).toBe('/get-quote');
    // The corner X and the footer button both close it; use the footer one.
    const closers = within(dialog).getAllByRole('button', { name: 'Close' });
    expect(closers).toHaveLength(2);
    fireEvent.click(closers[1]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('keeps the live SEO tags and WebPage structured data', async () => {
    await renderNavigator();
    await waitFor(() =>
      expect(document.title).toBe('Why Choose Navigate Wealth | Independent Financial Advisory'),
    );
    await waitFor(() => expect(document.getElementById('seo-structured-data')).not.toBeNull());
    const data = document.getElementById('seo-structured-data')!.textContent!;
    expect(data).toContain('WebPage');
    expect(data).toContain('/why-us');
  });

  it('gives every image an alt and keeps heading order', async () => {
    const { container } = await renderNavigator();
    for (const img of container.querySelectorAll('img')) expect(img.hasAttribute('alt')).toBe(true);
    const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
      Number(h.tagName[1]),
    );
    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1]).toBeLessThanOrEqual(1);
    });
  });
});
