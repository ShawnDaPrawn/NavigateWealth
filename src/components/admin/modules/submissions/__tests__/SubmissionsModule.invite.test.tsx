/**
 * The header's Invite action must open its dialog on both tabs: the shared
 * header shows the button on Archived too, so the dialog renders with it.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../hooks/useSubmissions', () => ({
  useSubmissions: () => ({
    submissions: [],
    isLoading: false,
    error: null,
    updateSubmission: vi.fn(),
    deleteSubmission: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('../components/SubmissionInviteModal', () => ({
  SubmissionInviteModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="Invite" /> : null,
}));

import { SubmissionsModule } from '../SubmissionsModule';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SubmissionsModule />
    </MemoryRouter>,
  );
}

describe('SubmissionsModule invite action', () => {
  it('opens the invite dialog from the board', () => {
    renderAt('/admin');
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(screen.getByRole('dialog', { name: 'Invite' })).toBeTruthy();
  });

  it('opens the invite dialog from the archived tab', () => {
    renderAt('/admin?tab=archived');
    expect(screen.queryByRole('dialog', { name: 'Invite' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(screen.getByRole('dialog', { name: 'Invite' })).toBeTruthy();
  });
});
