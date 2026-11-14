import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, renderWithQueryClient, screen, waitFor } from '@/test/utils';
import { MemoryRouter, useLocation } from 'react-router';
import type { Client } from '../../types';

const notes = [
  {
    id: 'n1',
    title: 'Annual review prep',
    content: 'Confirm beneficiaries',
    tags: [],
    isPinned: false,
    isArchived: false,
  },
];
const mutation = { mutate: vi.fn(), mutateAsync: vi.fn() };
const notesState = vi.hoisted(() => ({ error: null as Error | null, refetch: () => undefined }));

vi.mock('../../../../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', firstName: 'Shawn', lastName: 'F' } }),
}));
vi.mock('../../../notes', () => ({
  useClientNotes: () =>
    notesState.error
      ? { data: undefined, isLoading: false, error: notesState.error, refetch: notesState.refetch }
      : { data: notes, isLoading: false, error: null, refetch: vi.fn() },
  useCreateNote: () => mutation,
  useUpdateNote: () => mutation,
  useDeleteNote: () => mutation,
  useConvertNoteToTask: () => mutation,
  NotesAPI: { updateNote: vi.fn() },
  NoteCard: (props: { note: { title: string }; onOpen: (n: unknown) => void }) => (
    <button onClick={() => props.onOpen(props.note)}>{props.note.title}</button>
  ),
  NoteEditorModal: (props: {
    isOpen: boolean;
    note: { title: string } | null;
    onClose: () => void;
  }) =>
    props.isOpen ? (
      <div>
        <h2>Editing {props.note ? props.note.title : 'new note'}</h2>
        <button onClick={props.onClose}>Close editor</button>
      </div>
    ) : null,
}));

import { ClientNotesTab } from '../ClientNotesTab';

afterEach(() => cleanup());

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const client = { id: 'c1', firstName: 'Elsa', lastName: 'van Wyk' } as Client;

function renderTab(url = '/') {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[url]}>
      <ClientNotesTab selectedClient={client} />
      <Location />
    </MemoryRouter>,
  );
}

describe('Client notes tab', () => {
  it('opens a note in place of the list, with its own address', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Annual review prep' }));
    expect(await screen.findByRole('heading', { name: 'Editing Annual review prep' })).toBeTruthy();
    expect(screen.getByTestId('search').textContent).toBe('?note=n1');
    expect(screen.queryByRole('button', { name: /Add note/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
    expect(screen.getByRole('button', { name: /Add note/ })).toBeTruthy();
  });

  it('opens a new note from Add note, and the note named in the address', async () => {
    renderTab('/?note=new');
    expect(await screen.findByRole('heading', { name: 'Editing new note' })).toBeTruthy();
  });

  it('says so when the note in the address does not exist', () => {
    renderTab('/?note=gone');
    expect(screen.getByText('This note could not be opened.')).toBeTruthy();
  });

  it('shows an error, not "No notes", when notes fail to load', () => {
    const refetch = vi.fn();
    notesState.error = new Error('400');
    notesState.refetch = refetch;
    try {
      renderTab();
      expect(screen.getByText("Couldn't load notes")).toBeTruthy();
      expect(screen.queryByText(/No notes for this client/)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(refetch).toHaveBeenCalled();
    } finally {
      notesState.error = null;
    }
  });
});
