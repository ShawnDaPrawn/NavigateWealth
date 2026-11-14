/**
 * Internal presentational pieces of the notes module: the note sorter, the
 * unpinned note grid/list, the stat card, and the empty state. Moved
 * verbatim from NotesModule.tsx.
 */
import { DsButton, DsState } from '../../layout/page';
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
      <div className="flex flex-col gap-2">
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
    <div className="ds-ngrid">
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
    <div className="ds-card">
      {isSearch ? (
        <DsState
          title="No notes match your filters"
          action={
            onClearFilters && (
              <DsButton size="sm" onClick={onClearFilters}>
                Clear filters
              </DsButton>
            )
          }
        >
          Try a different search, or clear the filters.
        </DsState>
      ) : isArchived ? (
        <DsState title="No archived notes">
          Notes you archive are kept here, out of the way.
        </DsState>
      ) : (
        <DsState
          title="No notes yet"
          action={
            <DsButton size="sm" variant="primary" onClick={onNewNote}>
              Create first note
            </DsButton>
          }
        >
          Create your first note to start capturing ideas, meeting notes and client information.
        </DsState>
      )}
    </div>
  );
}
