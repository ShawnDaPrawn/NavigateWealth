/**
 * DraggablePinnedGrid — Drag-and-drop reordering for pinned notes
 *
 * §7 — Presentation + local UI state only
 * §8.4 — Uses react-dnd per Figma Make library guidance
 *
 * Pin order is persisted to localStorage keyed by personnelId.
 * Falls back gracefully when DnD is unavailable.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { Note, NoteViewMode } from '../types';
import { PIN_ORDER_STORAGE_KEY } from '../constants';
import { NoteCard } from './NoteCard';
import { GripVertical } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

const DRAG_TYPE = 'PINNED_NOTE';

interface DragItem {
  id: string;
  index: number;
}

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
// STORAGE HELPERS
// ============================================================================

function getStorageKey(personnelId: string): string {
  return `${PIN_ORDER_STORAGE_KEY}_${personnelId}`;
}

function loadPinOrder(personnelId: string): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(personnelId));
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function savePinOrder(personnelId: string, order: string[]): void {
  try {
    localStorage.setItem(getStorageKey(personnelId), JSON.stringify(order));
  } catch {
    // Fail silently
  }
}

// ============================================================================
// APPLY CUSTOM ORDER
// ============================================================================

function applyCustomOrder(notes: Note[], savedOrder: string[]): Note[] {
  if (savedOrder.length === 0) return notes;

  const orderMap = new Map(savedOrder.map((id, idx) => [id, idx]));
  const ordered = [...notes];

  ordered.sort((a, b) => {
    const aIdx = orderMap.get(a.id);
    const bIdx = orderMap.get(b.id);
    // Both in saved order — use saved positions
    if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
    // Only one in saved order — it comes first
    if (aIdx !== undefined) return -1;
    if (bIdx !== undefined) return 1;
    // Neither in saved order — keep original relative order
    return 0;
  });

  return ordered;
}

// ============================================================================
// DRAGGABLE CARD WRAPPER
// ============================================================================

function DraggableNoteWrapper({
  note,
  index,
  moveNote,
  viewMode,
  handlers,
  isSelecting,
  isSelected,
  onToggleSelect,
}: {
  note: Note;
  index: number;
  moveNote: (dragIndex: number, hoverIndex: number) => void;
  viewMode: NoteViewMode;
  handlers: NoteCardHandlers;
  isSelecting: boolean;
  isSelected: boolean;
  onToggleSelect: (noteId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DRAG_TYPE,
    item: (): DragItem => ({ id: note.id, index }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: () => !isSelecting,
  });

  const [{ isOver }, drop] = useDrop({
    accept: DRAG_TYPE,
    hover(item: DragItem, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      // For list view, use vertical midpoint
      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      // Only move when cursor crosses midpoint
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      moveNote(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  preview(drop(ref));

  return (
    <div
      ref={ref}
      className={`relative group/drag ${isDragging ? 'opacity-30' : ''} ${isOver ? 'ring-2 ring-purple-300 rounded-lg' : ''}`}
    >
      {/* Drag handle — shown on hover, not in select mode */}
      {!isSelecting && (
        <div
          ref={drag}
          className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing opacity-0 group-hover/drag:opacity-100 transition-opacity"
          title="Drag to reorder"
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
          onClick={(e) => { e.stopPropagation(); onToggleSelect(note.id); }}
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-purple-600 border-purple-600 text-white'
              : 'bg-white/90 border-gray-300 hover:border-purple-400'
          }`}>
            {isSelected && (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
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

  // Re-derive order when notes change (new pins, unpins, etc.)
  useEffect(() => {
    const savedOrder = loadPinOrder(personnelId);
    setOrderedNotes(applyCustomOrder(notes, savedOrder));
  }, [notes, personnelId]);

  const moveNote = useCallback((dragIndex: number, hoverIndex: number) => {
    setOrderedNotes((prev) => {
      const updated = [...prev];
      const [removed] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, removed);
      // Persist new order
      savePinOrder(personnelId, updated.map((n) => n.id));
      return updated;
    });
  }, [personnelId]);

  const containerClass = viewMode === 'list'
    ? 'space-y-2'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={containerClass}>
        {orderedNotes.map((note, index) => (
          <DraggableNoteWrapper
            key={note.id}
            note={note}
            index={index}
            moveNote={moveNote}
            viewMode={viewMode}
            handlers={handlers}
            isSelecting={isSelecting}
            isSelected={selectedIds.has(note.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </DndProvider>
  );
}