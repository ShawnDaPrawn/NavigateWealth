/** Invite applicant and Reject: centred dialogs that check their fields inline. */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';

const invite = vi.hoisted(() => vi.fn());
vi.mock('../../api', () => ({ applicationsApi: { inviteApplicant: (p: unknown) => invite(p) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { InviteDialog } from '../InviteDialog';
import { DeclineDialog } from '../ActionDialogs';

describe('InviteDialog', () => {
  it('says which fields to fix before sending', () => {
    render(<InviteDialog open onOpenChange={vi.fn()} onInviteSent={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Invite applicant' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'nope@' } });
    fireEvent.click(screen.getByRole('button', { name: /Send invitation/ }));
    expect(screen.getByText('Enter a first name')).toBeTruthy();
    expect(screen.getByText('Enter a valid email address, like name@example.com')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Fix 3 fields to send the invitation');
    expect(invite).not.toHaveBeenCalled();
  });
});

describe('DeclineDialog', () => {
  function Harness({ onConfirm }: { onConfirm: () => void }) {
    const [reason, setReason] = useState('');
    return (
      <DeclineDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        loading={false}
        reason={reason}
        setReason={setReason}
        applicantName="Nadia Hendricks"
      />
    );
  }

  it('needs a reason before rejecting', () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    expect(screen.getByText("Reject Nadia Hendricks's application?")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reject application' }));
    expect(screen.getByText('Please provide a reason for rejection')).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Incomplete FICA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject application' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
