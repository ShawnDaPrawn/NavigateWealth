/**
 * NoteEditorModal — Render / Characterization Test (Phase 4)
 * ===========================================================
 *
 * Locks the null guard (returns null when isOpen is false), dialog titles
 * ("New Note" / "Edit Note"), and the Write/Summarise mode toggle for this
 * 944-line Phase 6 decomposition target.
 *
 * useSummariseNote and VoiceRecorderButton are mocked to avoid React Query
 * context requirements and MediaDevices API usage in jsdom.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';

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

const noop = vi.fn();
const noopSave = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NoteEditorModal', () => {
  it('renders nothing (returns null) when isOpen is false', () => {
    const { container } = render(
      <NoteEditorModal
        isOpen={false}
        onClose={noop}
        personnelId="p-1"
        personnelName="Test User"
        onSave={noopSave}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "New Note" dialog title when open with no note', () => {
    render(
      <NoteEditorModal
        isOpen={true}
        onClose={noop}
        personnelId="p-1"
        personnelName="Test User"
        onSave={noopSave}
      />,
    );
    expect(screen.getByText('New Note')).toBeTruthy();
  });

  it('shows "Edit Note" title when open with an existing note', () => {
    render(
      <NoteEditorModal
        isOpen={true}
        onClose={noop}
        note={
          {
            id: 'n-1',
            title: 'My Note',
            content: 'Existing note',
            color: 'default',
            tags: [],
          } as never
        }
        personnelId="p-1"
        personnelName="Test User"
        onSave={noopSave}
      />,
    );
    expect(screen.getByText('Edit Note')).toBeTruthy();
  });

  // Regression: the form-reset effect used to depend on the unstable autoSave
  // object, re-running on every render and wiping title/content as you typed.
  it('keeps typed text in the title and content fields', () => {
    render(
      <NoteEditorModal
        isOpen={true}
        onClose={noop}
        personnelId="p-1"
        personnelName="Test User"
        onSave={noopSave}
      />,
    );

    const titleInput = screen.getByPlaceholderText('Note title...') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Meeting notes' } });
    expect(titleInput.value).toBe('Meeting notes');

    const contentArea = screen.getByPlaceholderText(/write your note here/i) as HTMLTextAreaElement;
    fireEvent.change(contentArea, { target: { value: 'Discussed portfolio rebalance' } });
    expect(contentArea.value).toBe('Discussed portfolio rebalance');
    expect(titleInput.value).toBe('Meeting notes');
  });

  it('renders the searchable client picker trigger when clients are provided', () => {
    render(
      <NoteEditorModal
        isOpen={true}
        onClose={noop}
        personnelId="p-1"
        personnelName="Test User"
        clients={[{ id: 'c-1', name: 'Jane Doe' }]}
        onSave={noopSave}
      />,
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger.textContent).toContain('No client linked');
  });
});
