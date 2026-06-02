/**
 * ReviewDialog — Render / Characterization Test (Phase 4)
 * =========================================================
 *
 * Locks the closed-dialog guard (returns null when selectedApplication is
 * null), the open + submitted application render (full name in title, Approve
 * + Reject buttons), and the non-actionable state (approved application hides
 * the action buttons) BEFORE the Phase 6 decomposition of this 1,825-line
 * component splits it into sub-sections.
 *
 * applicationsApi is mocked (the amendment save is the only network call; it
 * never fires in a read-only review). ExternalProvidersSection is a pure-UI
 * child — no need to stub it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils';
import type { Application, ApplicationData } from '@/components/admin/modules/applications/types';

vi.mock('@/components/admin/modules/applications/api', () => ({
  applicationsApi: {
    updateApplicationData: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { ReviewDialog } from '../ReviewDialog';

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

describe('ReviewDialog', () => {
  it('renders nothing (returns null) when selectedApplication is null', () => {
    const { container } = render(
      <ReviewDialog
        open={true}
        onOpenChange={noop}
        selectedApplication={null}
        onApprove={noop}
        onDecline={noop}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows applicant full name in the dialog title for a submitted application', () => {
    render(
      <ReviewDialog
        open={true}
        onOpenChange={noop}
        selectedApplication={makeApplication('submitted')}
        onApprove={noop}
        onDecline={noop}
      />,
    );
    expect(screen.getAllByText(/Jane Smith/i).length).toBeGreaterThan(0);
  });

  it('shows Approve and Reject buttons for a pending (submitted) application', () => {
    render(
      <ReviewDialog
        open={true}
        onOpenChange={noop}
        selectedApplication={makeApplication('submitted')}
        onApprove={noop}
        onDecline={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /approve/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /reject/i })).toBeTruthy();
  });

  it('hides the Approve and Reject buttons for an already-approved application', () => {
    render(
      <ReviewDialog
        open={true}
        onOpenChange={noop}
        selectedApplication={makeApplication('approved')}
        onApprove={noop}
        onDecline={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
  });

  it('calls onApprove with the application when Approve is clicked', () => {
    const onApprove = vi.fn();
    const app = makeApplication('submitted');
    render(
      <ReviewDialog
        open={true}
        onOpenChange={noop}
        selectedApplication={app}
        onApprove={onApprove}
        onDecline={noop}
      />,
    );
    screen.getByRole('button', { name: /approve/i }).click();
    expect(onApprove).toHaveBeenCalledWith(app);
  });

  it('calls onDecline with the application when Reject is clicked', () => {
    const onDecline = vi.fn();
    const app = makeApplication('submitted');
    render(
      <ReviewDialog
        open={true}
        onOpenChange={noop}
        selectedApplication={app}
        onApprove={noop}
        onDecline={onDecline}
      />,
    );
    screen.getByRole('button', { name: /reject/i }).click();
    expect(onDecline).toHaveBeenCalledWith(app);
  });
});
