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
import { screen, waitFor, renderWithQueryClient } from '@/test/utils';

const { mutStub } = vi.hoisted(() => {
  const mutStub = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return { mutStub };
});

vi.mock('@/components/admin/modules/notes/hooks', () => ({
  useNotes: () => ({ data: [], isLoading: false }),
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
  NoteEditorModal: () => null,
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
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { NotesModule } from '../NotesModule';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotesModule', () => {
  it('renders without throwing and shows the Notes heading', async () => {
    renderWithQueryClient(<NotesModule />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Notes' })).toBeTruthy();
    });
  });

  it('shows the New Note button', async () => {
    renderWithQueryClient(<NotesModule />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new note/i })).toBeTruthy();
    });
  });
});
