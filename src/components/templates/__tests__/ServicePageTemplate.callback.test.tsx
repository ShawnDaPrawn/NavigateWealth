/**
 * The "Let us call you back" form on every service page must deliver the lead.
 *
 * Until October 2026 the form only cleared itself and opened a "Request
 * Submitted Successfully" dialog — nothing was sent, so every call-back
 * request from all eight service pages was lost. This drives the real form on
 * the Risk Management page and asserts the enquiry reaches the contact-form
 * endpoint, and that a failed send is reported instead of shown as success.
 *
 * Run: npx vitest run src/components/templates/__tests__/ServicePageTemplate.callback.test.tsx
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (msg: string) => toastError(msg), success: vi.fn() } }));
vi.mock('../../../utils/supabase/info', () => ({ projectId: 'proj', publicAnonKey: 'anon' }));
vi.mock('../../modals/ConsultationModal', () => ({ ConsultationModal: () => null }));
vi.mock('../../modals/ThankYouModal', () => ({
  ThankYouModal: ({ open }: { open: boolean }) => (open ? <div>Thank-you shown</div> : null),
}));

// jsdom has no element scrolling; the page's tab strips call it on mount.
Element.prototype.scrollTo = () => {};

const { RiskManagementPage } = await import('../../pages/RiskManagementPage');

function fillAndSubmit() {
  fireEvent.change(screen.getByPlaceholderText('Enter your full name'), {
    target: { value: 'Jane van der Merwe' },
  });
  fireEvent.change(screen.getByPlaceholderText('Enter your email'), {
    target: { value: 'jane@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Enter your phone number'), {
    target: { value: '082 000 0000' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Call Me Back/ }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  toastError.mockReset();
});

describe('service page call-back form', () => {
  it('sends the enquiry to the contact-form endpoint before confirming', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <RiskManagementPage />
      </MemoryRouter>,
    );
    fillAndSubmit();

    await waitFor(() => expect(screen.getByText('Thank-you shown')).toBeDefined());

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/contact-form/submit'));
    expect(call).toBeDefined();
    const body = JSON.parse(call![1].body);
    expect(body).toMatchObject({
      firstName: 'Jane',
      lastName: 'van der Merwe',
      email: 'jane@example.com',
      phone: '082 000 0000',
      clientType: 'call-back request',
    });
    expect(body.service).toMatch(/Risk|Insurance/);
  });

  it('reports a failed send and does not show the success dialog', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Validation failed' }) }),
    );

    render(
      <MemoryRouter>
        <RiskManagementPage />
      </MemoryRouter>,
    );
    fillAndSubmit();

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Validation failed'));
    expect(screen.queryByText('Thank-you shown')).toBeNull();
  });
});
