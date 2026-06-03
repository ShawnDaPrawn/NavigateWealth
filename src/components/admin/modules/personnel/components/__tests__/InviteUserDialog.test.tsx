/**
 * InviteUserDialog — Render / Characterization Test (Phase 4)
 * ============================================================
 *
 * Locks the dialog title ("Invite Team Member"), the primary submit button,
 * and the role selection cards for this 886-line Phase 6 decomposition target.
 *
 * No API calls — the component delegates submission via onInvite / onCreateAccount
 * callback props, so no HTTP mocking is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { InviteUserDialog } from '../InviteUserDialog';

const noop = vi.fn();
const noopInvite = vi.fn().mockResolvedValue(true);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InviteUserDialog', () => {
  it('shows "Invite Team Member" dialog title when open', () => {
    render(<InviteUserDialog open={true} onOpenChange={noop} onInvite={noopInvite} />);

    expect(screen.getAllByText('Invite Team Member').length).toBeGreaterThan(0);
  });

  it('shows the Send Invitation submit button when open in invite mode', () => {
    render(<InviteUserDialog open={true} onOpenChange={noop} onInvite={noopInvite} />);

    expect(screen.getByRole('button', { name: /send invitation/i })).toBeTruthy();
  });

  it('shows Financial Adviser role card when open', () => {
    render(<InviteUserDialog open={true} onOpenChange={noop} onInvite={noopInvite} />);

    expect(screen.getAllByText('Financial Adviser').length).toBeGreaterThan(0);
  });
});
