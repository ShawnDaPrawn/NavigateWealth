/**
 * With the design switch off — production today — the home page is the live
 * layout, unchanged by the redesign: its rotating headline is still the H1 and
 * nothing from the Navigator design is on the page. The redesign has its own
 * tests in src/site/__tests__/NavigatorHomePage.test.tsx.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../../site/design', () => ({
  SITE_DESIGN: 'legacy',
  resolveSiteDesign: () => 'legacy',
}));

const { HomePage } = await import('../HomePage');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.getElementById('seo-structured-data')?.remove();
});

describe('HomePage with the design switch off', () => {
  it('renders the live layout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1.textContent).toBe('Secure Your Financial  Future.');
    expect(document.querySelector('.nw-site')).toBeNull();
    // The live first slide still leads to sign-up; only the redesign changed it.
    expect(screen.getByRole('link', { name: /Get Started/ }).getAttribute('href')).toBe('/signup');
  });
});
