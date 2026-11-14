import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Personnel } from '../../../types';

const suspend = vi.hoisted(() => vi.fn());
const restore = vi.hoisted(() => vi.fn());
const sendReset = vi.hoisted(() => vi.fn());
const cancelInvite = vi.hoisted(() => vi.fn());
const perms = vi.hoisted(() => ({
  isSuperAdmin: false,
  canDo: (_m: string, _c: string): boolean => true,
}));

vi.mock('../../../hooks', () => ({
  useResendPersonnelInvite: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelPersonnelInvite: () => ({ mutate: cancelInvite, isPending: false }),
  useSuspendPersonnelAccess: () => ({ mutate: suspend, isPending: false }),
  useRestorePersonnelAccess: () => ({ mutate: restore, isPending: false }),
  useSendPersonnelPasswordReset: () => ({ mutate: sendReset, isPending: false }),
  usePersonnel: () => ({ data: [] }),
}));
vi.mock('../../../hooks/usePermissions', () => ({
  useCurrentUserPermissions: () => ({
    canDo: perms.canDo,
    isSuperAdmin: perms.isSuperAdmin,
    permissions: { personnelId: 'me' },
  }),
}));

import { TabProfile } from '../TabProfile';
import { sentAgo } from '../sentAgo';

function person(overrides: Partial<Personnel> = {}): Personnel {
  return {
    id: 'p-naledi',
    name: 'Naledi Khumalo',
    firstName: 'Naledi',
    lastName: 'Khumalo',
    email: 'naledi@example.com',
    role: 'adviser',
    phone: '',
    status: 'active',
    commissionSplit: 0.7,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Personnel;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  perms.isSuperAdmin = false;
  perms.canDo = () => true;
});

describe('TabProfile — access actions', () => {
  it('suspends access with a reason from a dialog', () => {
    render(<TabProfile selectedPersonnel={person()} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suspend user access' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain("Naledi Khumalo won't be able to sign in");
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Left the practice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suspend access' }));
    expect(suspend).toHaveBeenCalledWith(
      { id: 'p-naledi', reason: 'Left the practice' },
      expect.any(Object),
    );
  });

  it('sends a password reset link after confirming in a dialog', () => {
    render(<TabProfile selectedPersonnel={person()} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(screen.getByRole('dialog').textContent).toContain(
      'Send Naledi Khumalo a password reset link at naledi@example.com?',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(sendReset).toHaveBeenCalledWith(
      { id: 'p-naledi', email: 'naledi@example.com' },
      expect.any(Object),
    );
  });

  it('offers Restore access for a suspended staff member, after a confirmation', async () => {
    render(<TabProfile selectedPersonnel={person({ status: 'suspended' })} onUpdate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Suspend user access' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset password' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restore access' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore access', hidden: false }));
    await waitFor(() => expect(restore).toHaveBeenCalledWith('p-naledi'));
  });

  it('does not offer the admin password reset on your own profile', () => {
    render(<TabProfile selectedPersonnel={person({ id: 'me' })} onUpdate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Reset password' })).toBeNull();
  });

  it('hides suspend and reset without the capabilities, and for a super admin target', () => {
    perms.canDo = () => false;
    render(<TabProfile selectedPersonnel={person()} onUpdate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Suspend user access' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset password' })).toBeNull();
    cleanup();

    perms.canDo = () => true;
    render(<TabProfile selectedPersonnel={person({ role: 'super_admin' })} onUpdate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Suspend user access' })).toBeNull();
  });

  it('confirms before cancelling a pending invitation', async () => {
    const onCancelled = vi.fn();
    render(
      <TabProfile
        selectedPersonnel={person({ status: 'pending' })}
        onUpdate={vi.fn()}
        onInviteCancelled={onCancelled}
      />,
    );
    expect(screen.getByText(/Invitation pending/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel invitation' }));
    expect(await screen.findByText('Cancel this invitation?')).toBeDefined();
    expect(cancelInvite).not.toHaveBeenCalled();
  });
});

describe('sentAgo', () => {
  const now = new Date(2026, 10, 13, 10, 0);
  it('counts calendar days', () => {
    expect(sentAgo(new Date(2026, 10, 13, 8).toISOString(), now)).toBe('today');
    expect(sentAgo(new Date(2026, 10, 12, 23).toISOString(), now)).toBe('yesterday');
    expect(sentAgo(new Date(2026, 10, 11, 9).toISOString(), now)).toBe('2 days ago');
    expect(sentAgo('not a date', now)).toBe('recently');
  });
});
