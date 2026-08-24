/**
 * DraggablePinnedGrid — reorder interaction.
 *
 * This test is only possible because the board moved off react-dnd. Its
 * HTML5Backend listens for real browser drag events that jsdom does not
 * produce, so the drag gesture was untestable and the component was stubbed to
 * `() => null` in the one suite that touched it. Native drag events are plain
 * DOM events, so the gesture can now be driven directly.
 *
 * The assertions are about the OUTCOME an adviser would notice — the order that
 * gets persisted — not about the mechanics of the gesture.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import type { Note } from '../../types';

vi.mock('../NoteCard', () => ({
  NoteCard: ({ note }: { note: Note }) => <div data-testid={`note-${note.id}`}>{note.title}</div>,
}));

import { DraggablePinnedGrid } from '../DraggablePinnedGrid';
import { getStorageKey } from '../../pinOrder';

const note = (id: string) => ({ id, title: `Note ${id}` }) as Note;
const NOTES = [note('a'), note('b'), note('c')];
const PERSONNEL = 'p-1';

const handlers = {
  onOpen: vi.fn(),
  onPin: vi.fn(),
  onArchive: vi.fn(),
  onDelete: vi.fn(),
  onConvertToTask: vi.fn(),
};

function renderGrid(overrides: Partial<React.ComponentProps<typeof DraggablePinnedGrid>> = {}) {
  return render(
    <DraggablePinnedGrid
      notes={NOTES}
      viewMode="grid"
      handlers={handlers}
      personnelId={PERSONNEL}
      isSelecting={false}
      selectedIds={new Set()}
      onToggleSelect={vi.fn()}
      {...overrides}
    />,
  );
}

/** Drives a full native drag from one card onto another. */
function dragCardOnto(fromId: string, toId: string) {
  const handle = screen.getByTestId(`pin-drag-handle-${fromId}`);
  const target = screen.getByTestId(`pin-card-${toId}`);
  fireEvent.dragStart(handle, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
  fireEvent.dragEnter(target);
  fireEvent.dragOver(target, { dataTransfer: { dropEffect: '' } });
  fireEvent.drop(target, { dataTransfer: { getData: () => fromId } });
}

const storedOrder = () => JSON.parse(localStorage.getItem(getStorageKey(PERSONNEL)) ?? '[]');

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('DraggablePinnedGrid', () => {
  it('renders every pinned note', () => {
    renderGrid();
    expect(screen.getByTestId('note-a')).toBeTruthy();
    expect(screen.getByTestId('note-b')).toBeTruthy();
    expect(screen.getByTestId('note-c')).toBeTruthy();
  });

  it('persists the new order when a card is dragged onto a later one', () => {
    renderGrid();
    dragCardOnto('a', 'c');
    expect(storedOrder()).toEqual(['b', 'c', 'a']);
  });

  it('persists the new order when a card is dragged onto an earlier one', () => {
    renderGrid();
    dragCardOnto('c', 'a');
    expect(storedOrder()).toEqual(['c', 'a', 'b']);
  });

  it('writes nothing when a card is dropped on itself', () => {
    renderGrid();
    dragCardOnto('b', 'b');
    expect(localStorage.getItem(getStorageKey(PERSONNEL))).toBeNull();
  });

  it('renders in the saved order on mount', () => {
    localStorage.setItem(getStorageKey(PERSONNEL), JSON.stringify(['c', 'b', 'a']));
    renderGrid();
    const rendered = screen.getAllByTestId(/^pin-card-/).map((el) => el.dataset.testid);
    expect(rendered).toEqual(['pin-card-c', 'pin-card-b', 'pin-card-a']);
  });

  it('offers no drag handles in selection mode', () => {
    // Dragging and multi-select are mutually exclusive; the handle is the only
    // draggable element, so its absence is what disables the gesture.
    renderGrid({ isSelecting: true });
    expect(screen.queryByTestId('pin-drag-handle-a')).toBeNull();
  });

  it('ignores a drop in selection mode', () => {
    const { rerender } = renderGrid();
    // Start a drag, then flip into selection mode before releasing.
    fireEvent.dragStart(screen.getByTestId('pin-drag-handle-a'), {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    });
    rerender(
      <DraggablePinnedGrid
        notes={NOTES}
        viewMode="grid"
        handlers={handlers}
        personnelId={PERSONNEL}
        isSelecting
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
      />,
    );
    fireEvent.drop(screen.getByTestId('pin-card-c'));
    expect(localStorage.getItem(getStorageKey(PERSONNEL))).toBeNull();
  });

  it('keeps each personnel id’s order separate', () => {
    localStorage.setItem(getStorageKey('someone-else'), JSON.stringify(['c', 'b', 'a']));
    renderGrid();
    // Another person's saved order must not drive this board.
    const rendered = screen.getAllByTestId(/^pin-card-/).map((el) => el.dataset.testid);
    expect(rendered).toEqual(['pin-card-a', 'pin-card-b', 'pin-card-c']);
  });
});
