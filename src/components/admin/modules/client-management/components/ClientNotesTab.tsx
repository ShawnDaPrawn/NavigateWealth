/**
 * ClientNotesTab — Notes tab for the Client Drawer
 *
 * Shows all notes linked to a specific client, with the ability to
 * create new notes pre-linked to that client.
 *
 * §7 — Presentation only
 * §8.1 — Mirrors existing tab layout patterns
 */

import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../../auth/AuthContext';
import type { Client } from '../types';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../../notes/types';
import {
  useClientNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useConvertNoteToTask,
} from '../../notes/hooks';
import { NotesAPI } from '../../notes/api';
import { noteKeys } from '../../../../../utils/queryKeys';
import { NoteCard } from '../../notes/components/NoteCard';
import { NoteEditorModal } from '../../notes/components/NoteEditorModal';

import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Badge } from '../../../../ui/badge';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Plus,
  Search,
  StickyNote,
  Pin,
} from 'lucide-react';

interface ClientNotesTabProps {
  selectedClient: Client;
}

export function ClientNotesTab({ selectedClient }: ClientNotesTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const personnelId = user?.id || '';
  const personnelName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Admin';
  const clientFullName = [selectedClient.firstName, selectedClient.lastName].filter(Boolean).join(' ');

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: notes = [], isLoading } = useClientNotes(selectedClient.id);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const convertToTask = useConvertNoteToTask();

  // ── UI State ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredNotes = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [notes, search]);

  const stats = useMemo(() => ({
    total: notes.length,
    pinned: notes.filter((n) => n.isPinned).length,
    converted: notes.filter((n) => !!n.convertedToTaskId).length,
  }), [notes]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleOpenNote = useCallback((note: Note) => {
    setSelectedNote(note);
    setEditorOpen(true);
  }, []);

  const handleNewNote = useCallback(() => {
    setSelectedNote(null);
    setEditorOpen(true);
  }, []);

  const handleSave = useCallback(
    async (input: CreateNoteInput | UpdateNoteInput) => {
      if ('personnelId' in input) {
        await createNote.mutateAsync(input);
      } else {
        await updateNote.mutateAsync(input);
      }
    },
    [createNote, updateNote]
  );

  const handlePin = useCallback(
    (note: Note) => { updateNote.mutate({ id: note.id, isPinned: !note.isPinned }); },
    [updateNote]
  );

  const handleArchive = useCallback(
    (note: Note) => { updateNote.mutate({ id: note.id, isArchived: !note.isArchived }); },
    [updateNote]
  );

  const handleDelete = useCallback(
    (note: Note) => { deleteNote.mutate(note.id); },
    [deleteNote]
  );

  const handleConvertToTask = useCallback(
    (note: Note) => { convertToTask.mutate(note.id); },
    [convertToTask]
  );

  // ── Silent auto-save handler ────────────────────────────────────────────
  const handleAutoSave = useCallback(
    async (input: UpdateNoteInput) => {
      await NotesAPI.updateNote(input);
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(input.id) });
    },
    [queryClient]
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border rounded-lg overflow-hidden">
              <Skeleton className="h-10 w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">Notes</h3>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-xs">
              {stats.total} {stats.total === 1 ? 'note' : 'notes'}
            </Badge>
            {stats.pinned > 0 && (
              <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                <Pin className="h-3 w-3 mr-0.5" /> {stats.pinned}
              </Badge>
            )}
          </div>
        </div>
        <Button onClick={handleNewNote} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
          <Plus className="h-4 w-4 mr-1" /> Add Note
        </Button>
      </div>

      {/* Search (only show when there are notes) */}
      {notes.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
      )}

      {/* Notes */}
      {filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <StickyNote className="h-6 w-6 text-gray-400" />
          </div>
          {search.trim() ? (
            <>
              <p className="text-sm font-medium text-gray-900">No matching notes</p>
              <p className="text-xs text-gray-500 mt-0.5">Try different search terms.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900">No notes for this client</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Create a note to capture meeting minutes, follow-ups, or key information.
              </p>
              <Button onClick={handleNewNote} size="sm" variant="outline" className="mt-3">
                <Plus className="h-4 w-4 mr-1" /> Create Note
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              viewMode="grid"
              onOpen={handleOpenNote}
              onPin={handlePin}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onConvertToTask={handleConvertToTask}
            />
          ))}
        </div>
      )}

      {/* Editor Modal — pre-linked to this client */}
      <NoteEditorModal
        isOpen={editorOpen}
        onClose={() => { setEditorOpen(false); setSelectedNote(null); }}
        note={selectedNote}
        personnelId={personnelId}
        personnelName={personnelName}
        defaultClientId={selectedClient.id}
        defaultClientName={clientFullName}
        onSave={handleSave}
        onAutoSave={handleAutoSave}
        onDelete={(id) => { deleteNote.mutate(id); }}
        onConvertToTask={(id) => { convertToTask.mutate(id); }}
      />
    </div>
  );
}