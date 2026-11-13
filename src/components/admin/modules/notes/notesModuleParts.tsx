/**
 * Internal presentational pieces of the notes module: the note sorter, the
 * unpinned note grid/list, the stat card, and the empty state. Moved
 * verbatim from NotesModule.tsx.
 */
import { Button } from '../../../ui/button';
import { Plus, StickyNote } from 'lucide-react';
import type { Note, NoteViewMode } from './types';
import { NoteCard } from './components/NoteCard';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NoteGrid({
  notes,
  viewMode,
  handlers,
  isSelecting,
  selectedIds,
  onToggleSelect,
}: {
  notes: Note[];
  viewMode: NoteViewMode;
  handlers: {
    onOpen: (note: Note) => void;
    onPin: (note: Note) => void;
    onArchive: (note: Note) => void;
    onDelete: (note: Note) => void;
    onConvertToTask: (note: Note) => void;
  };
  isSelecting: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (noteId: string) => void;
}) {
  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            viewMode="list"
            onOpen={handlers.onOpen}
            onPin={handlers.onPin}
            onArchive={handlers.onArchive}
            onDelete={handlers.onDelete}
            onConvertToTask={handlers.onConvertToTask}
            isSelecting={isSelecting}
            isSelected={selectedIds.has(note.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          viewMode="grid"
          onOpen={handlers.onOpen}
          onPin={handlers.onPin}
          onArchive={handlers.onArchive}
          onDelete={handlers.onDelete}
          onConvertToTask={handlers.onConvertToTask}
          isSelecting={isSelecting}
          isSelected={selectedIds.has(note.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  isSearch,
  isArchived = false,
  onNewNote,
  onClearFilters,
}: {
  isSearch: boolean;
  isArchived?: boolean;
  onNewNote: () => void;
  onClearFilters?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-nw-line bg-white px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <StickyNote className="h-6 w-6 text-gray-400" aria-hidden="true" />
      </div>
      {isSearch ? (
        <>
          <h3 className="text-base font-semibold text-nw-ink">No notes found</h3>
          <p className="mt-1 max-w-sm text-sm text-nw-text-3">
            Try adjusting your search terms or filters.
          </p>
          {onClearFilters && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </>
      ) : isArchived ? (
        <>
          <h3 className="text-base font-semibold text-nw-ink">No archived notes</h3>
          <p className="mt-1 max-w-sm text-sm text-nw-text-3">
            Notes you archive are kept here, out of the way.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold text-nw-ink">No notes yet</h3>
          <p className="mt-1 max-w-sm text-sm text-nw-text-3">
            Create your first note to start capturing ideas, meeting notes, and client information.
          </p>
          <Button onClick={onNewNote} size="sm" className="mt-4">
            <Plus className="h-4 w-4" aria-hidden="true" /> Create first note
          </Button>
        </>
      )}
    </div>
  );
}
