/**
 * DraggablePinnedGrid — Drag-and-drop reordering for pinned notes
 *
 * §7 — Presentation + local UI state only
 * Reordering uses the platform's own HTML5 drag events rather than a library.
 * The board renders as a multi-column CSS grid, and @hello-pangea/dnd — the one
 * drag library this codebase keeps — states in its own README that "grid
 * layouts are not supported (yet)". Rather than keep react-dnd alive for this
 * one component, or downgrade the board to a single column to suit the library,
 * the ~30 lines of native wiring below do the job and work in any layout.
 *
 * The ordering rules themselves live in ../pinOrder and the move in
 * shared/utils/reorder, so what is here is only the gesture.
 *
 * Pin order is persisted to localStorage keyed by personnelId.
 */

import { useCallback, useState, useEffect } from 'react';
import type { Note, NoteViewMode } from '../types';
import { applyCustomOrder, loadPinOrder, savePinOrder } from '../pinOrder';
import { moveItem } from '../../../../../shared/utils';
import { NoteCard } from './NoteCard';
import { GripVertical } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface NoteCardHandlers {
  onOpen: (note: Note) => void;
  onPin: (note: Note) => void;
  onArchive: (note: Note) => void;
  onDelete: (note: Note) => void;
  onConvertToTask: (note: Note) => void;
}

interface DraggablePinnedGridProps {
  notes: Note[];
  viewMode: NoteViewMode;
  handlers: NoteCardHandlers;
  personnelId: string;
  /** Selection mode props */
  isSelecting: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (noteId: string) => void;
}

// ============================================================================
// DRAGGABLE CARD WRAPPER
// ============================================================================

function DraggableNoteWrapper({
  note,
  index,
  viewMode,
  handlers,
  isSelecting,
  isSelected,
  onToggleSelect,
  isDragging,
  isOver,
  onDragStart,
  onDragEnterIndex,
  onDropAtIndex,
  onDragFinish,
}: {
  note: Note;
  index: number;
  viewMode: NoteViewMode;
  handlers: NoteCardHandlers;
  isSelecting: boolean;
  isSelected: boolean;
  onToggleSelect: (noteId: string) => void;
  /** This card is the one being dragged. */
  isDragging: boolean;
  /** This card is the current drop target. */
  isOver: boolean;
  onDragStart: (index: number) => void;
  onDragEnterIndex: (index: number) => void;
  onDropAtIndex: (index: number) => void;
  onDragFinish: () => void;
}) {
  return (
    <div
      onDragOver={(event) => {
        // Without preventDefault the browser refuses the drop outright.
        if (isSelecting) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={() => !isSelecting && onDragEnterIndex(index)}
      data-testid={`pin-card-${note.id}`}
      onDrop={(event) => {
        if (isSelecting) return;
        event.preventDefault();
        onDropAtIndex(index);
      }}
      className={`relative group/drag ${isDragging ? 'opacity-30' : ''} ${isOver ? 'ring-2 ring-purple-300 rounded-lg' : ''}`}
    >
      {/* Drag handle — shown on hover, not in select mode */}
      {!isSelecting && (
        <div
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            // Firefox will not start a drag unless some data is set.
            event.dataTransfer.setData('text/plain', note.id);
            onDragStart(index);
          }}
          onDragEnd={onDragFinish}
          className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing opacity-0 group-hover/drag:opacity-100 transition-opacity"
          title="Drag to reorder"
          data-testid={`pin-drag-handle-${note.id}`}
        >
          <div className="flex items-center justify-center w-5 h-8 rounded bg-gray-800/80 text-white shadow-md hover:bg-gray-700">
            <GripVertical className="h-3.5 w-3.5" />
          </div>
        </div>
      )}

      {/* Selection checkbox overlay */}
      {isSelecting && (
        <button
          type="button"
          className="absolute top-2 left-2 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(note.id);
          }}
        >
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'bg-white/90 border-gray-300 hover:border-purple-400'
            }`}
          >
            {isSelected && (
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </button>
      )}

      <NoteCard
        note={note}
        viewMode={viewMode}
        onOpen={handlers.onOpen}
        onPin={handlers.onPin}
        onArchive={handlers.onArchive}
        onDelete={handlers.onDelete}
        onConvertToTask={handlers.onConvertToTask}
      />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DraggablePinnedGrid({
  notes,
  viewMode,
  handlers,
  personnelId,
  isSelecting,
  selectedIds,
  onToggleSelect,
}: DraggablePinnedGridProps) {
  const [orderedNotes, setOrderedNotes] = useState<Note[]>(notes);
  /** Index the gesture started from, and the card currently under the cursor. */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  // Re-derive order when notes change (new pins, unpins, etc.)
  useEffect(() => {
    const savedOrder = loadPinOrder(personnelId);
    setOrderedNotes(applyCustomOrder(notes, savedOrder));
  }, [notes, personnelId]);

  const moveNote = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      setOrderedNotes((prev) => {
        const updated = moveItem(prev, dragIndex, hoverIndex);
        // Persist new order
        savePinOrder(
          personnelId,
          updated.map((n) => n.id),
        );
        return updated;
      });
    },
    [personnelId],
  );

  const handleDragStart = useCallback((index: number) => setDragIndex(index), []);
  const handleDragEnterIndex = useCallback((index: number) => setOverIndex(index), []);
  const handleDragFinish = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  /**
   * The move commits on drop. react-dnd used to reorder repeatedly during
   * hover; the persisted result is the same, but the cards no longer shuffle
   * under the cursor mid-gesture.
   */
  const handleDropAtIndex = useCallback(
    (targetIndex: number) => {
      setDragIndex((from) => {
        if (from !== null && from !== targetIndex) moveNote(from, targetIndex);
        return null;
      });
      setOverIndex(null);
    },
    [moveNote],
  );

  const containerClass =
    viewMode === 'list'
      ? 'space-y-2'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

  return (
    <div className={containerClass}>
      {orderedNotes.map((note, index) => (
        <DraggableNoteWrapper
          key={note.id}
          note={note}
          index={index}
          viewMode={viewMode}
          handlers={handlers}
          isSelecting={isSelecting}
          isSelected={selectedIds.has(note.id)}
          onToggleSelect={onToggleSelect}
          isDragging={dragIndex === index}
          isOver={overIndex === index && dragIndex !== index}
          onDragStart={handleDragStart}
          onDragEnterIndex={handleDragEnterIndex}
          onDropAtIndex={handleDropAtIndex}
          onDragFinish={handleDragFinish}
        />
      ))}
    </div>
  );
}
