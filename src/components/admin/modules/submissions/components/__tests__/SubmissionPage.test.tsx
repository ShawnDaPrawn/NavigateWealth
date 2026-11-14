/** One submission as a page: header actions, status picker, notes, delete. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Submission } from '../../types';

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: vi.fn() },
}));

import { SubmissionPage } from '../SubmissionPage';

const submission = {
  id: 'abcd-8f21',
  type: 'client_signup',
  status: 'new',
  sourceChannel: 'website_form',
  payload: { firstName: 'Sipho', userId: 'u-1', applicationNumber: 'APP-2026-0004' },
  submitterName: 'Sipho Ndlovu',
  submitterEmail: 'sipho.n@example.com',
  submittedAt: '2026-03-24T10:00:00Z',
  updatedAt: '2026-03-24T10:00:00Z',
} as unknown as Submission;

const onStatusChange = vi.fn().mockResolvedValue(undefined);
const onNotesChange = vi.fn().mockResolvedValue({ success: true });
const onDelete = vi.fn();
const onClose = vi.fn();

beforeEach(() => vi.clearAllMocks());

function renderPage() {
  render(
    <MemoryRouter>
      <SubmissionPage
        submission={submission}
        onClose={onClose}
        onStatusChange={onStatusChange}
        onNotesChange={onNotesChange}
        onDelete={onDelete}
      />
    </MemoryRouter>,
  );
}

describe('SubmissionPage', () => {
  it('is a page with the status picker beside the title and actions in the header', () => {
    renderPage();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Sipho Ndlovu' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeTruthy();
    expect(screen.getByText(/SUB-•••8f21/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to board' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More submission actions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View in Applications' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open client profile' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeTruthy();
  });

  it('marks it completed and archives it from the header', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Mark completed' }));
    expect(onStatusChange).toHaveBeenCalledWith('abcd-8f21', 'completed');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Archive' }).hasAttribute('disabled')).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onStatusChange).toHaveBeenCalledWith('abcd-8f21', 'archived');
  });

  it('saves internal notes with feedback', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Internal notes'), { target: { value: 'Called back' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save notes' }));
    await waitFor(() => expect(onNotesChange).toHaveBeenCalledWith('abcd-8f21', 'Called back'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Notes saved'));
  });

  it('confirms before deleting', async () => {
    renderPage();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More submission actions' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete…' }));
    await screen.findByRole('alertdialog');
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('abcd-8f21'));
  });
});
