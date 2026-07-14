import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../Logo', () => ({
  Logo: () => <div data-testid="nav-logo" />,
}));
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));
vi.mock('../../auth/UserProfileDropdown', () => ({
  UserProfileDropdown: () => null,
}));

import { Navigation } from '../Navigation';
import { serviceItems, solutionItems, companyItems } from '../navigationData';

function renderNavigation() {
  return render(
    <MemoryRouter>
      <Navigation forcePublic />
    </MemoryRouter>,
  );
}

/** Open a NavigationMenu trigger (click toggles the panel). */
function openMenu(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function getPanelLink(name: RegExp): HTMLElement {
  return screen.getByRole('link', { name });
}

describe('Navigation mega menus', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows all services as tiles with descriptions, the panel image and the CTA', async () => {
    renderNavigation();

    openMenu(/^Services$/);
    await screen.findByAltText("Coins and a growing plant on an adviser's desk");

    for (const item of serviceItems) {
      const link = getPanelLink(new RegExp(item.label));
      expect(link.getAttribute('href')).toBe(item.path);
      expect(link.textContent).toContain(item.description);
    }

    const cta = getPanelLink(/View all services/i);
    expect(cta.getAttribute('href')).toBe('/services');
  });

  it('shows the solutions tiles with descriptions and panel image', async () => {
    renderNavigation();

    openMenu(/^Solutions$/);
    await screen.findByAltText('Financial adviser consulting with clients');

    for (const item of solutionItems) {
      const link = getPanelLink(new RegExp(item.label));
      expect(link.getAttribute('href')).toBe(item.path);
      expect(link.textContent).toContain(item.description);
    }
  });

  it('shows the company tiles with descriptions and panel image', async () => {
    renderNavigation();

    openMenu(/^Company$/);
    await screen.findByAltText('Navigate Wealth advisers working with a client');

    for (const item of companyItems) {
      const link = getPanelLink(new RegExp(item.label.replace('?', '\\?')));
      expect(link.getAttribute('href')).toBe(item.path);
      expect(link.textContent).toContain(item.description);
    }
  });

  it('keeps the mobile accordion listing every service', () => {
    renderNavigation();

    fireEvent.click(screen.getByRole('button', { name: /Open menu/i }));
    // Both the desktop trigger and the mobile accordion button are named
    // "Services" once the mobile panel is open; the accordion renders last.
    const serviceButtons = screen.getAllByRole('button', { name: /^Services$/ });
    fireEvent.click(serviceButtons[serviceButtons.length - 1]);

    for (const item of serviceItems) {
      const links = screen
        .getAllByRole('link', { name: new RegExp(item.label) })
        .filter((el) => el.getAttribute('href') === item.path);
      expect(links.length).toBeGreaterThan(0);
    }
  });
});
