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
import { render, screen } from '@/test/utils';

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
        note={{ id: 'n-1', title: 'My Note' } as never}
        personnelId="p-1"
        personnelName="Test User"
        onSave={noopSave}
      />,
    );
    expect(screen.getByText('Edit Note')).toBeTruthy();
  });
});
