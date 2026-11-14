/** "Invite a client": a centred dialog with inline validation and a sent state. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const sendInvite = vi.hoisted(() => vi.fn());
vi.mock('../../api', () => ({ submissionsApi: { sendInvite: (p: unknown) => sendInvite(p) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SubmissionInviteModal } from '../SubmissionInviteModal';

beforeEach(() => sendInvite.mockReset());

describe('SubmissionInviteModal', () => {
  it('asks for the email inline, then sends and shows the sent state', async () => {
    sendInvite.mockResolvedValue({ success: true });
    render(<SubmissionInviteModal open onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Invite a client' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(7);

    fireEvent.click(screen.getByRole('button', { name: /Send invitation email/ }));
    expect(await screen.findByText("Enter the recipient's email address")).toBeTruthy();
    expect(sendInvite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: /Tax planning/ }));
    fireEvent.change(screen.getByLabelText('Recipient name'), {
      target: { value: 'Sipho Ndlovu' },
    });
    fireEvent.change(screen.getByLabelText(/Recipient email/), {
      target: { value: 'sipho@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send invitation email/ }));
    await waitFor(() => expect(sendInvite).toHaveBeenCalled());
    expect(sendInvite.mock.calls[0][0]).toMatchObject({
      recipientEmail: 'sipho@example.com',
      inviteTypeId: 'tax-planning',
    });
    expect(await screen.findByText('Invitation sent')).toBeTruthy();
    expect(screen.getByText(/Sipho Ndlovu will get an email/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Invite another' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });
});
