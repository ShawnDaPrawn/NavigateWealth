/**
 * NotesModule — Render / Characterization Test (Phase 4)
 * =======================================================
 *
 * Locks the mount contract and the "Notes" h1 heading for this 1,024-line
 * Phase 6 decomposition target.
 *
 * Notes hooks, useAuth, api, and NoteEditorModal are mocked. The component
 * uses useQueryClient directly, so renderWithQueryClient is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, renderWithQueryClient, fireEvent } from '@/test/utils';
import { MemoryRouter, useLocation } from 'react-router';
import type { Note } from '../types';

const notesData = vi.hoisted(() => ({ list: [] as unknown[] }));
const toastError = vi.hoisted(() => vi.fn());

const { mutStub } = vi.hoisted(() => ({
  mutStub: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/components/admin/modules/notes/hooks', () => ({
  useNotes: () => ({ data: notesData.list, isLoading: false, error: null, refetch: vi.fn() }),
  useCreateNote: mutStub,
  useUpdateNote: mutStub,
  useDeleteNote: mutStub,
  useConvertNoteToTask: mutStub,
  useColourLabels: () => ({
    customLabels: {},
    setLabel: vi.fn(),
    setAllLabels: vi.fn(),
    getLabel: vi.fn().mockReturnValue(''),
    getTooltip: vi.fn().mockReturnValue(''),
  }),
}));

vi.mock('@/components/admin/modules/notes/components/NoteEditorModal', () => ({
  NoteEditorModal: (props: { note?: { title: string } | null; onClose: () => void }) => (
    <div>
      <h1>{props.note ? props.note.title : 'New note'}</h1>
      <button onClick={props.onClose}>Back to notes</button>
    </div>
  ),
}));

vi.mock('@/components/admin/modules/notes/components/ColourLabelsDialog', () => ({
  ColourLabelsDialog: () => null,
}));

vi.mock('@/components/admin/modules/notes/components/DraggablePinnedGrid', () => ({
  DraggablePinnedGrid: () => null,
}));

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'p-1', email: 'test@example.com' } }),
}));

vi.mock('@/utils/api/client', () => ({
  api: { get: vi.fn().mockResolvedValue({ clients: [] }) },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (m: string) => toastError(m), info: vi.fn() },
}));

import { NotesModule } from '../NotesModule';

const makeNote = (over: Partial<Note>): Note =>
  ({
    content: '',
    personnelId: 'p-1',
    personnelName: 'Erin',
    color: 'default',
    tags: [],
    isPinned: false,
    isArchived: false,
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-03T00:00:00Z',
    ...over,
  }) as Note;

beforeEach(() => {
  vi.clearAllMocks();
  notesData.list = [];
});

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderAt(url = '/admin?module=notes') {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[url]}>
      <NotesModule />
      <Location />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotesModule', () => {
  it('renders without throwing and shows the Notes heading', async () => {
    renderAt();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Notes' })).toBeTruthy();
    });
  });

  it('shows the New Note button', async () => {
    renderAt();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new note/i })).toBeTruthy();
    });
  });

  it('shows Active, Archived and All as tabs with counts, kept in the address', async () => {
    notesData.list = [
      makeNote({ id: 'a', title: 'Annual review prep', clientId: 'c1', clientName: 'Elsa' }),
      makeNote({ id: 'b', title: 'FSCA levy', isPinned: true }),
      makeNote({ id: 'c', title: 'Old provider list', isArchived: true }),
    ];
    renderAt();
    expect(screen.getByRole('tab', { name: /Active/ }).textContent).toContain('2');
    expect(screen.getByRole('tab', { name: /Archived/ }).textContent).toContain('1');
    expect(screen.getByRole('tab', { name: /All/ }).textContent).toContain('3');
    expect(screen.getByText('Total notes')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pinned' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'All notes' })).toBeTruthy();
    expect(screen.queryByText('Old provider list')).toBeNull();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Archived/ }), { button: 0 });
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=notes&tab=archived'),
    );
    expect(screen.getByText('Old provider list')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search archived notes…')).toBeTruthy();
  });

  it('offers filter chips, sort and a Grid | List control kept in the address', async () => {
    notesData.list = [makeNote({ id: 'a', title: 'Annual review prep' })];
    renderAt();
    expect(screen.getByRole('button', { name: 'Filter by client' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Filter by colour' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Filter by tag' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sort: Last updated/ })).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'List' }), { button: 0 });
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=notes&layout=list'),
    );
  });

  it('opens a note as a page with the note in the address', async () => {
    notesData.list = [makeNote({ id: 'a', title: 'Annual review prep' })];
    renderAt();
    fireEvent.click(screen.getByText('Annual review prep'));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Annual review prep' })).toBeTruthy(),
    );
    expect(screen.getByTestId('search').textContent).toBe('?module=notes&note=a');
    fireEvent.click(screen.getByRole('button', { name: 'Back to notes' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?module=notes'));
  });

  it('opens a new note at ?note=new and drops an unknown note with a message', async () => {
    renderAt('/admin?module=notes&note=new');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'New note' }));

    renderAt('/admin?module=notes&note=missing');
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Note not found'));
  });

  it('shows the bulk bar in select mode', () => {
    notesData.list = [makeNote({ id: 'a', title: 'Annual review prep' })];
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(bar.textContent).toContain('0 selected');
    expect(screen.getByRole('button', { name: 'Exit select' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Delete…/ }).hasAttribute('disabled')).toBe(true);
  });
});
