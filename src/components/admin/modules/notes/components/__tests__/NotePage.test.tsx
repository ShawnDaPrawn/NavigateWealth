/**
 * The note editor as a page (the Notes module's variant): header actions,
 * the colour control, inline title validation and the delete confirmation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import type { Note } from '../../types';

vi.mock('@/components/admin/modules/notes/hooks/useSummariseNote', () => ({
  useSummariseNote: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('@/components/admin/modules/notes/components/VoiceRecorderButton', () => ({
  VoiceRecorderButton: () => null,
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { NoteEditorModal } from '../NoteEditorModal';

const note = {
  id: 'n-1',
  title: 'Annual review prep',
  content: 'Confirm beneficiaries',
  personnelId: 'p-1',
  personnelName: 'Erin',
  color: 'default',
  tags: ['review'],
  isPinned: false,
  isArchived: false,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-03T00:00:00Z',
} as unknown as Note;

const onClose = vi.fn();
const onSave = vi.fn().mockResolvedValue(undefined);

beforeEach(() => vi.clearAllMocks());

function renderPage(props: Partial<React.ComponentProps<typeof NoteEditorModal>> = {}) {
  return render(
    <NoteEditorModal
      variant="page"
      isOpen
      onClose={onClose}
      personnelId="p-1"
      personnelName="Erin"
      onSave={onSave}
      {...props}
    />,
  );
}

describe('Note page', () => {
  it('shows a note as a page, not a dialog, with its actions in the header', () => {
    renderPage({ note, onDelete: vi.fn(), onConvertToTask: vi.fn(), onTogglePin: vi.fn() });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Annual review prep' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to notes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Convert to task' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More note actions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Colour' })).toBeTruthy();
    expect(screen.getByText(/not generated yet/)).toBeTruthy();
  });

  it('asks for a title inline before creating a note', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'New note' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
    expect(await screen.findByText('Give the note a title')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Call notes' } });
    fireEvent.click(screen.getByRole('radio', { name: /Blue/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create note' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ title: 'Call notes', color: 'blue' });
  });

  it('confirms before deleting', async () => {
    const onDelete = vi.fn();
    renderPage({ note, onDelete });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More note actions' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete…' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain(
      'Delete “Annual review prep”? This action cannot be undone.',
    );
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('n-1'));
  });
});
