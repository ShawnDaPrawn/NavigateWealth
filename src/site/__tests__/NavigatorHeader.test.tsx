import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../../components/layout/Logo', () => ({
  Logo: () => <img alt="Navigate Wealth" data-testid="current-logo" />,
}));

import { NavigatorHeader } from '../layout/NavigatorHeader';
import { companyItems, serviceItems, solutionItems } from '../../components/layout/navigationData';

function renderHeader(path = '/', isScrolled = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavigatorHeader isScrolled={isScrolled} />
    </MemoryRouter>,
  );
}

function hrefOf(name: RegExp | string) {
  return screen.getByRole('link', { name }).getAttribute('href');
}

describe('NavigatorHeader', () => {
  afterEach(() => cleanup());

  it('keeps the current logo, linked home', () => {
    renderHeader();
    const home = screen.getByRole('link', { name: 'Navigate Wealth home' });
    expect(home.getAttribute('href')).toBe('/');
    expect(within(home).getByTestId('current-logo')).toBeTruthy();
  });

  it('offers the same top-bar contacts as the live site', () => {
    renderHeader();
    expect(screen.getByText('Mon – Fri, 08:30 – 16:30')).toBeTruthy();
    expect(hrefOf('012 667 2505')).toBe('tel:+27126672505');
    expect(hrefOf('info@navigatewealth.co')).toBe('mailto:info@navigatewealth.co');
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsapp.getAttribute('href')).toBe('https://wa.me/message/BOLRR5DSCWNAG1');
    expect(whatsapp.getAttribute('rel')).toBe('noopener noreferrer');
    expect(hrefOf('Get Quote')).toBe('/get-quote');
  });

  it('keeps every top-level menu item and both account actions', () => {
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    for (const label of ['Services', 'Solutions', 'Company']) {
      expect(within(nav).getByRole('button', { name: label })).toBeTruthy();
    }
    const links: Record<string, string> = {
      Home: '/',
      'Ask Vasco': '/ask-vasco',
      Resources: '/resources',
      Contact: '/contact',
      'Log In': '/login',
    };
    for (const [name, path] of Object.entries(links)) {
      expect(within(nav).getByRole('link', { name }).getAttribute('href')).toBe(path);
    }
    for (const link of within(nav).getAllByRole('link', { name: 'Get Started' })) {
      expect(link.getAttribute('href')).toBe('/signup');
    }
  });

  it.each([
    ['Services', serviceItems],
    ['Solutions', solutionItems],
    ['Company', companyItems],
  ])('opens the %s mega menu with every page from the shared menu data', (label, items) => {
    renderHeader();
    const trigger = screen.getByRole('button', { name: label });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
    expect(panel).toBeTruthy();
    for (const item of items) {
      const tile = within(panel as HTMLElement).getByRole('link', {
        name: new RegExp(item.label.replace(/[?]/g, '\\?')),
      });
      expect(tile.getAttribute('href')).toBe(item.path);
    }
    // Every panel image has a description for screen readers.
    for (const img of within(panel as HTMLElement).getAllByRole('img')) {
      expect(img.getAttribute('alt')).toBeTruthy();
    }
  });

  it('closes an open menu on Escape, a second click, or an outside click', () => {
    renderHeader();
    const trigger = screen.getByRole('button', { name: 'Services' });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('marks the section of the current page', () => {
    renderHeader('/medical-aid');
    expect(screen.getByRole('button', { name: 'Services' }).getAttribute('data-active')).toBe(
      'true',
    );
    cleanup();
    renderHeader('/contact');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Contact' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('marks Resources, without calling it the current page, on an article or issue', () => {
    renderHeader('/resources/article/the-will-you-signed');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const resources = within(nav).getByRole('link', { name: 'Resources' });
    expect(resources.getAttribute('data-active')).toBe('true');
    expect(resources.getAttribute('aria-current')).toBeNull();
  });

  it('marks Contact, without calling it the current page, while booking a consultation', () => {
    renderHeader('/schedule-consultation');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const contact = within(nav).getByRole('link', { name: 'Contact' });
    expect(contact.getAttribute('data-active')).toBe('true');
    expect(contact.getAttribute('aria-current')).toBeNull();
  });

  it('gives phones a labelled menu that expands each section', () => {
    renderHeader();
    const burger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(burger);
    expect(burger.getAttribute('aria-label')).toBe('Close menu');
    expect(burger.getAttribute('aria-expanded')).toBe('true');
    const sheet = document.getElementById(burger.getAttribute('aria-controls') ?? '');
    expect(sheet).toBeTruthy();
    const scope = within(sheet as HTMLElement);
    fireEvent.click(scope.getByRole('button', { name: 'Services' }));
    expect(scope.getByRole('link', { name: 'All services' }).getAttribute('href')).toBe(
      '/services',
    );
    for (const item of serviceItems) {
      expect(scope.getByRole('link', { name: item.label }).getAttribute('href')).toBe(item.path);
    }
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeTruthy();
  });

  it('collapses the top bar once the page scrolls', () => {
    const { container } = renderHeader('/', true);
    expect(container.querySelector('.nwh-top')?.getAttribute('data-collapsed')).toBe('true');
    expect(container.querySelector('.nwh-bar')?.getAttribute('data-scrolled')).toBe('true');
  });
});
