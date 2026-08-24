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

export function StatCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export function EmptyState({ isSearch, onNewNote }: { isSearch: boolean; onNewNote: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <StickyNote className="h-8 w-8 text-gray-400" />
      </div>
      {isSearch ? (
        <div className="contents">
          <h3 className="text-lg font-semibold text-gray-900">No notes found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            Try adjusting your search terms or filters.
          </p>
        </div>
      ) : (
        <div className="contents">
          <h3 className="text-lg font-semibold text-gray-900">No notes yet</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            Create your first note to start capturing ideas, meeting notes, and client information.
          </p>
          <Button onClick={onNewNote} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="h-4 w-4 mr-1" /> Create First Note
          </Button>
        </div>
      )}
    </div>
  );
}
