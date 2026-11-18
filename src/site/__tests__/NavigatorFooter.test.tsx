import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const api = vi.hoisted(() => ({ post: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('../../utils/api/client', () => ({ api }));
vi.mock('sonner', () => ({ toast }));

import { NavigatorFooter } from '../layout/NavigatorFooter';
import { Footer as LegacyFooter } from '../../components/layout/Footer';

function linkTargets(root: HTMLElement): string[] {
  return within(root)
    .getAllByRole('link')
    .map(
      (a) => `${a.textContent?.trim() || a.getAttribute('aria-label')}|${a.getAttribute('href')}`,
    )
    .sort();
}

describe('NavigatorFooter', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('links to exactly the pages and profiles the live footer does', () => {
    const legacy = render(
      <MemoryRouter>
        <LegacyFooter />
      </MemoryRouter>,
    );
    const legacyHrefs = new Set(
      within(legacy.container)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    );
    cleanup();
    const next = render(
      <MemoryRouter>
        <NavigatorFooter />
      </MemoryRouter>,
    );
    const nextHrefs = new Set(
      within(next.container)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    );
    // The live footer shows the phone number and email as plain text; the
    // redesign makes them tappable. Everything else must match exactly.
    const contactLinks = ['mailto:info@navigatewealth.co', 'tel:+27126672505'];
    const pageHrefs = [...nextHrefs].filter((href) => !contactLinks.includes(href ?? ''));
    expect(pageHrefs.sort()).toEqual([...legacyHrefs].sort());
    for (const href of contactLinks) expect(nextHrefs.has(href)).toBe(true);
    // Sanity: the list is the real one, not two empty sets agreeing.
    expect(linkTargets(next.container).length).toBeGreaterThan(20);
  });

  it('carries the Important Disclosure word for word', () => {
    render(
      <MemoryRouter>
        <NavigatorFooter />
      </MemoryRouter>,
    );
    const disclosure = screen.getByText(/is a South African financial advisory firm/);
    const text = disclosure.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('Important Disclosure:');
    expect(text).toContain('Wealthfront (Pty) Ltd (Reg No. 2024/071953/07)');
    expect(text).toContain('authorised Financial Services Provider (FSP No. 54606)');
    expect(text).toContain('Past performance is not necessarily indicative of future results.');
    expect(text).toContain('Full terms and conditions are available on our Legal page.');
  });

  it('shows the confirmed Pretoria address and opens social profiles safely', () => {
    render(
      <MemoryRouter>
        <NavigatorFooter />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Route 21 Business Park, Pretoria, 0157/)).toBeTruthy();
    for (const name of [/LinkedIn/, /Instagram/, /on X/]) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  describe('newsletter sign-up', () => {
    function renderForm() {
      render(
        <MemoryRouter>
          <NavigatorFooter />
        </MemoryRouter>,
      );
      return {
        email: screen.getByLabelText('Email address'),
        submit: screen.getByRole('button', { name: /Subscribe/ }),
      };
    }

    it('rejects a malformed address without calling the server', () => {
      const { email, submit } = renderForm();
      fireEvent.change(email, { target: { value: 'not-an-email' } });
      fireEvent.click(submit);
      expect(toast.error).toHaveBeenCalledWith('Please enter a valid email address');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('drops a bot submission that fills the hidden field', () => {
      const { email, submit } = renderForm();
      fireEvent.change(email, { target: { value: 'person@example.com' } });
      fireEvent.change(document.getElementById('nwf-website') as HTMLInputElement, {
        target: { value: 'https://spam.example' },
      });
      fireEvent.click(submit);
      expect(api.post).not.toHaveBeenCalled();
    });

    it('subscribes through the same endpoint as the live footer', async () => {
      api.post.mockResolvedValue({ requiresConfirmation: true });
      const { email, submit } = renderForm();
      fireEvent.change(email, { target: { value: 'person@example.com' } });
      fireEvent.click(submit);
      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith(
          '/newsletter/subscribe',
          { email: 'person@example.com' },
          { retryTransientFailures: false },
        ),
      );
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });
  });
});
