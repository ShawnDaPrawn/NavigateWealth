/**
 * ReviewPage — an application as a page: header, section rail, SYNC note,
 * Amend, and the decision bar (Approve / Reject disabled while amendments
 * are unsaved).
 *
 * applicationsApi is mocked (the amendment save is the only network call; it
 * never fires in a read-only review). ExternalProvidersSection is a pure-UI
 * child — no need to stub it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@/test/utils';
import type { Application, ApplicationData } from '@/components/admin/modules/applications/types';

vi.mock('@/components/admin/modules/applications/api', () => ({
  applicationsApi: {
    updateApplicationData: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { ReviewPage } from '../ReviewPage';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeAppData(over: Partial<ApplicationData> = {}): ApplicationData {
  return {
    firstName: 'Jane',
    lastName: 'Smith',
    dateOfBirth: '1990-01-15',
    gender: 'Female',
    nationality: 'South African',
    emailAddress: 'jane@example.co.za',
    cellphoneNumber: '0821234567',
    residentialAddressLine1: '10 Maple Rd',
    residentialCity: 'Cape Town',
    residentialProvince: 'Western Cape',
    residentialCountry: 'South Africa',
    employmentStatus: 'employed',
    accountReasons: ['investments'],
    financialGoals: 'Grow wealth over 20 years.',
    termsAccepted: true,
    popiaConsent: true,
    disclosureAcknowledged: true,
    ...over,
  };
}

function makeApplication(
  status: Application['status'],
  dataOver: Partial<ApplicationData> = {},
): Application {
  return {
    id: 'app-1',
    user_id: 'user-1',
    status,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    application_data: makeAppData(dataOver),
    user_email: 'jane@example.co.za',
    user_name: 'Jane Smith',
  };
}

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

function renderPage(app: Application, over: Partial<React.ComponentProps<typeof ReviewPage>> = {}) {
  return render(
    <ReviewPage
      application={app}
      onClose={noop}
      backLabel="Pending review"
      onApprove={noop}
      onDecline={noop}
      {...over}
    />,
  );
}

describe('ReviewPage', () => {
  it('is a page with the name, a section rail and the SYNC note', () => {
    renderPage(makeApplication('submitted'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: /Jane Smith/ })).toBeTruthy();
    const rail = screen.getByRole('navigation', { name: 'Application sections' });
    for (const label of ['Personal information', 'Identification', 'Consent & agreements']) {
      expect(within(rail).getByRole('link', { name: label })).toBeTruthy();
    }
    expect(within(rail).getByRole('link', { name: /Profile field mapping/ })).toBeTruthy();
    expect(screen.getByText(/marks fields copied to the client profile on approval/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to pending review' })).toBeTruthy();
  });

  it('shows Approve and Reject for a pending application, and calls them', () => {
    const onApprove = vi.fn();
    const onDecline = vi.fn();
    const app = makeApplication('submitted');
    renderPage(app, { onApprove, onDecline });
    expect(
      screen.getByText(/Approving creates the client profile and gives Jane access/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).toHaveBeenCalledWith(app);
    fireEvent.click(screen.getByRole('button', { name: 'Reject…' }));
    expect(onDecline).toHaveBeenCalledWith(app);
  });

  it('hides Approve and Reject for an approved application, or without permission', () => {
    renderPage(makeApplication('approved'));
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    cleanup();
    renderPage(makeApplication('submitted'), { canApprove: false });
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('disables Approve / Reject while amendments are unsaved; Discard restores', () => {
    renderPage(makeApplication('submitted'));
    fireEvent.click(screen.getByRole('button', { name: 'Amend application' }));
    const firstName = screen.getAllByDisplayValue('Jane')[0];
    fireEvent.change(firstName, { target: { value: 'Janet' } });
    expect(screen.getByRole('button', { name: 'Approve' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Save (1)' })).toBeTruthy();
    expect(screen.getByText(/1 unsaved amendment/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByRole('button', { name: 'Approve' }).hasAttribute('disabled')).toBe(false);
  });
});
