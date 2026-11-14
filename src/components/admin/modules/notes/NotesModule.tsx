/**
 * NotesModule — Main entry point for the Notes module
 * Navigate Wealth Admin Dashboard
 *
 * Personnel-scoped note-taking with client linking, colour themes,
 * pinning, archiving, sorting, tag filtering, bulk actions,
 * saved filter presets, drag-and-drop pin reordering,
 * and convert-to-task functionality.
 *
 * §4.1 — Single presentation entry point
 * §7 — Presentation only; no business logic
 * §8 — Design System components throughout
 *
 * @module notes
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '../../../auth/AuthContext';
import type {
  Note,
  NoteColor,
  NoteViewMode,
  NoteArchiveFilter,
  NoteSortBy,
  CreateNoteInput,
  UpdateNoteInput,
} from './types';
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useConvertNoteToTask,
  useColourLabels,
} from './hooks';
import { NoteEditorModal } from './components/NoteEditorModal';
import { BulkActionsBar } from './components/BulkActionsBar';
import type { CurrentFilterState } from './components/FilterPresetBar';
import { DraggablePinnedGrid } from './components/DraggablePinnedGrid';
import { ColourLabelsDialog } from './components/ColourLabelsDialog';
import { useQueryClient } from '@tanstack/react-query';
import { noteKeys } from '../../../../utils/queryKeys';
import { useClients } from '../../../../hooks/useClients';
import { NotesAPI } from './api';
import { toast } from 'sonner';

import { Button } from '../../../ui/button';
import { Skeleton } from '../../../ui/skeleton';
import { Tabs } from '../../../ui/tabs';
import { Plus, CheckSquare, GripVertical } from 'lucide-react';

// ============================================================================
// SORT UTILITY (§7.1 — pure utility, no UI coupling)
// ============================================================================

import { EmptyState, NoteGrid } from './notesModuleParts';
import { sortNotes } from './notesSort';
import { NotesToolbar } from './NotesToolbar';
import {
  ErrorState,
  NavTabsList,
  NavTabsTrigger,
  PageHeader,
  StatCard,
  useBreadcrumbTrail,
  useRecordInUrl,
  useUrlState,
} from '../../layout/page';
import { taskAddress } from '../tasks/taskLink';

const NOTE_TABS = ['active', 'archived', 'all'] as const;
const NOTE_LAYOUTS = ['grid', 'list'] as const;
/** The address names a new note with this id. */
const NEW_NOTE = 'new';

export function NotesModule() {
  const { user } = useAuth();
  const personnelId = user?.id || '';
  const personnelName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Admin';
  const queryClient = useQueryClient();

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: notes = [], isLoading, error, refetch } = useNotes(personnelId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const [, setSearchParams] = useSearchParams();
  // "Open task" on the conversion toast goes to the task's page in To-Do.
  const openTask = useCallback(
    (taskId: string) => {
      setSearchParams(taskAddress(taskId));
    },
    [setSearchParams],
  );
  const convertToTask = useConvertNoteToTask({ onOpenTask: openTask });

  // ── Colour Labels (personnel-scoped custom descriptions) ─────────────────
  const colourLabels = useColourLabels(personnelId);
  const [colourLabelsOpen, setColourLabelsOpen] = useState(false);

  // Fetch clients for the linking dropdown. Reuse the shared useClients hook
  // (backed by the single-request profile/all-users endpoint) rather than
  // paging /clients — that route re-scans the full client set on every page,
  // so paging it would trigger one full scan per page.
  const { data: linkableClients, isError: clientsFailed } = useClients();
  // The client picker is secondary data: say so once, the notes still work.
  useEffect(() => {
    if (clientsFailed) {
      toast.error("Couldn't load clients for linking", {
        description: 'You can still write notes; try linking a client again later.',
      });
    }
  }, [clientsFailed]);

  const clientOptions = useMemo(() => {
    if (!Array.isArray(linkableClients)) return [];
    return linkableClients
      .filter((c) => c.id && c.full_name && c.full_name !== 'Unknown User')
      .map((c) => ({
        id: c.id,
        name: c.full_name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  }, [linkableClients]);

  // ── UI State: Filters ────────────────────────────────────────────────────
  // Active / Archived / All are tabs and Grid | List is a segmented control;
  // both are kept in the address (?tab=archived, ?layout=list).
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useUrlState<NoteViewMode>('layout', 'grid', NOTE_LAYOUTS);
  const [archiveFilter, setArchiveFilter] = useUrlState<NoteArchiveFilter>(
    'tab',
    'active',
    NOTE_TABS,
  );
  const [colorFilter, setColorFilter] = useState<NoteColor | 'all'>('all');
  const [sortBy, setSortBy] = useState<NoteSortBy>('updatedAt');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState<string>('all');

  // ── UI State: Editor ─────────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // ── UI State: Bulk Selection ─────────────────────────────────────────────
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkBusy, setIsBulkBusy] = useState(false);

  // ── Derived: All unique tags from notes ───────────────────────────────────
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  }, [notes]);

  // ── Derived: All unique linked clients ────────────────────────────────────
  const linkedClients = useMemo(() => {
    const map = new Map<string, string>();
    notes.forEach((n) => {
      if (n.clientId && n.clientName) {
        map.set(n.clientId, n.clientName);
      }
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [notes]);

  // ── Derived: are any filters set (the tab is not a filter) ────────────────
  const filtersActive =
    colorFilter !== 'all' ||
    selectedTags.length > 0 ||
    clientFilter !== 'all' ||
    search.trim() !== '';

  // ── Derived: Current filter state (for presets) ───────────────────────────
  const currentFilters: CurrentFilterState = useMemo(
    () => ({
      search,
      archiveFilter,
      colorFilter,
      sortBy,
      selectedTags,
      clientFilter,
    }),
    [search, archiveFilter, colorFilter, sortBy, selectedTags, clientFilter],
  );

  // ── Derived: Filtered & Sorted notes ──────────────────────────────────────
  const filteredNotes = useMemo(() => {
    let result = notes;

    if (archiveFilter === 'active') {
      result = result.filter((n) => !n.isArchived);
    } else if (archiveFilter === 'archived') {
      result = result.filter((n) => n.isArchived);
    }

    if (colorFilter !== 'all') {
      result = result.filter((n) => n.color === colorFilter);
    }

    if (selectedTags.length > 0) {
      result = result.filter((n) => selectedTags.every((tag) => n.tags.includes(tag)));
    }

    if (clientFilter !== 'all') {
      if (clientFilter === '__unlinked__') {
        result = result.filter((n) => !n.clientId);
      } else {
        result = result.filter((n) => n.clientId === clientFilter);
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)) ||
          (n.clientName && n.clientName.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [notes, archiveFilter, colorFilter, selectedTags, clientFilter, search]);

  // Separate pinned and unpinned, then sort each group
  const { pinnedNotes, unpinnedNotes } = useMemo(() => {
    const pinned = sortNotes(
      filteredNotes.filter((n) => n.isPinned),
      sortBy,
    );
    const unpinned = sortNotes(
      filteredNotes.filter((n) => !n.isPinned),
      sortBy,
    );
    return { pinnedNotes: pinned, unpinnedNotes: unpinned };
  }, [filteredNotes, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const active = notes.filter((n) => !n.isArchived);
    return {
      total: active.length,
      pinned: active.filter((n) => n.isPinned).length,
      linked: active.filter((n) => !!n.clientId).length,
      converted: notes.filter((n) => !!n.convertedToTaskId).length,
      archived: notes.filter((n) => n.isArchived).length,
      all: notes.length,
    };
  }, [notes]);

  // ── Derived: Bulk action data ─────────────────────────────────────────────
  const selectedNotes = useMemo(
    () => filteredNotes.filter((n) => selectedIds.has(n.id)),
    [filteredNotes, selectedIds],
  );

  const selectedNoteTags = useMemo(() => {
    const tagSet = new Set<string>();
    selectedNotes.forEach((n) => n.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [selectedNotes]);

  const hasArchivedSelected = selectedNotes.some((n) => n.isArchived);
  const hasActiveSelected = selectedNotes.some((n) => !n.isArchived);

  // ── Handlers: Notes ───────────────────────────────────────────────────────
  const handleOpenNote = useCallback(
    (note: Note) => {
      if (isSelecting) return; // In select mode, clicks toggle selection
      setSelectedNote(note);
      setEditorOpen(true);
    },
    [isSelecting],
  );

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
    [createNote, updateNote],
  );

  const handlePin = useCallback(
    (note: Note) => {
      updateNote.mutate({ id: note.id, isPinned: !note.isPinned });
    },
    [updateNote],
  );

  const handleArchive = useCallback(
    (note: Note) => {
      updateNote.mutate({ id: note.id, isArchived: !note.isArchived });
    },
    [updateNote],
  );

  const handleDelete = useCallback(
    (note: Note) => {
      deleteNote.mutate(note.id);
    },
    [deleteNote],
  );

  const handleConvertToTask = useCallback(
    (note: Note) => {
      convertToTask.mutate(note.id);
    },
    [convertToTask],
  );

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const handleClearFilters = useCallback(() => {
    setColorFilter('all');
    setSelectedTags([]);
    setClientFilter('all');
    setSearch('');
  }, []);

  // ── Handlers: Filter Presets ──────────────────────────────────────────────
  const handleApplyPreset = useCallback(
    (filters: CurrentFilterState) => {
      setSearch(filters.search);
      if (filters.archiveFilter !== archiveFilter) setArchiveFilter(filters.archiveFilter);
      setColorFilter(filters.colorFilter);
      setSortBy(filters.sortBy);
      setSelectedTags(filters.selectedTags);
      setClientFilter(filters.clientFilter);
    },
    [archiveFilter, setArchiveFilter],
  );

  // ── Handlers: Selection ───────────────────────────────────────────────────
  const handleToggleSelecting = useCallback(() => {
    setIsSelecting((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const handleToggleSelect = useCallback((noteId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredNotes.map((n) => n.id)));
  }, [filteredNotes]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelecting(false);
  }, []);

  // ── Handlers: Bulk Actions ────────────────────────────────────────────────
  const handleBulkArchive = useCallback(async () => {
    const targets = selectedNotes.filter((n) => !n.isArchived);
    if (targets.length === 0) return;
    setIsBulkBusy(true);
    try {
      await Promise.all(targets.map((n) => NotesAPI.updateNote({ id: n.id, isArchived: true })));
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
      toast.success(`${targets.length} note${targets.length > 1 ? 's' : ''} archived`);
      handleClearSelection();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to archive notes', { description: msg });
    } finally {
      setIsBulkBusy(false);
    }
  }, [selectedNotes, queryClient, handleClearSelection]);

  const handleBulkUnarchive = useCallback(async () => {
    const targets = selectedNotes.filter((n) => n.isArchived);
    if (targets.length === 0) return;
    setIsBulkBusy(true);
    try {
      await Promise.all(targets.map((n) => NotesAPI.updateNote({ id: n.id, isArchived: false })));
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
      toast.success(`${targets.length} note${targets.length > 1 ? 's' : ''} unarchived`);
      handleClearSelection();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to unarchive notes', { description: msg });
    } finally {
      setIsBulkBusy(false);
    }
  }, [selectedNotes, queryClient, handleClearSelection]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedNotes.length === 0) return;
    setIsBulkBusy(true);
    try {
      await Promise.all(selectedNotes.map((n) => NotesAPI.deleteNote(n.id)));
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
      toast.success(`${selectedNotes.length} note${selectedNotes.length > 1 ? 's' : ''} deleted`);
      handleClearSelection();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to delete notes', { description: msg });
    } finally {
      setIsBulkBusy(false);
    }
  }, [selectedNotes, queryClient, handleClearSelection]);

  const handleBulkAddTag = useCallback(
    async (tag: string) => {
      // Add tag to all selected notes that don't already have it
      const targets = selectedNotes.filter((n) => !n.tags.includes(tag));
      if (targets.length === 0) {
        toast.info(`All selected notes already have tag "${tag}"`);
        return;
      }
      setIsBulkBusy(true);
      try {
        await Promise.all(
          targets.map((n) => NotesAPI.updateNote({ id: n.id, tags: [...n.tags, tag] })),
        );
        queryClient.invalidateQueries({ queryKey: noteKeys.all });
        toast.success(
          `Tag "${tag}" added to ${targets.length} note${targets.length > 1 ? 's' : ''}`,
        );
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        toast.error('Failed to add tag', { description: msg });
      } finally {
        setIsBulkBusy(false);
      }
    },
    [selectedNotes, queryClient],
  );

  const handleBulkRemoveTag = useCallback(
    async (tag: string) => {
      const targets = selectedNotes.filter((n) => n.tags.includes(tag));
      if (targets.length === 0) return;
      setIsBulkBusy(true);
      try {
        await Promise.all(
          targets.map((n) =>
            NotesAPI.updateNote({ id: n.id, tags: n.tags.filter((t) => t !== tag) }),
          ),
        );
        queryClient.invalidateQueries({ queryKey: noteKeys.all });
        toast.success(
          `Tag "${tag}" removed from ${targets.length} note${targets.length > 1 ? 's' : ''}`,
        );
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        toast.error('Failed to remove tag', { description: msg });
      } finally {
        setIsBulkBusy(false);
      }
    },
    [selectedNotes, queryClient],
  );

  const handleBulkSetColor = useCallback(
    async (color: NoteColor) => {
      const targets = selectedNotes.filter((n) => n.color !== color);
      if (targets.length === 0) {
        toast.info('All selected notes already have that colour');
        return;
      }
      setIsBulkBusy(true);
      try {
        await Promise.all(targets.map((n) => NotesAPI.updateNote({ id: n.id, color })));
        queryClient.invalidateQueries({ queryKey: noteKeys.all });
        toast.success(`Colour updated for ${targets.length} note${targets.length > 1 ? 's' : ''}`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        toast.error('Failed to update colour', { description: msg });
      } finally {
        setIsBulkBusy(false);
      }
    },
    [selectedNotes, queryClient],
  );

  // ── Silent auto-save handler ─────────────────────────────────────────────
  const handleAutoSave = useCallback(
    async (input: UpdateNoteInput) => {
      await NotesAPI.updateNote(input);
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(input.id) });
    },
    [queryClient],
  );

  // ── Note card handlers bundle ─────────────────────────────────────────────
  const cardHandlers = useMemo(
    () => ({
      onOpen: handleOpenNote,
      onPin: handlePin,
      onArchive: handleArchive,
      onDelete: handleDelete,
      onConvertToTask: handleConvertToTask,
    }),
    [handleOpenNote, handlePin, handleArchive, handleDelete, handleConvertToTask],
  );

  // ── The open note (or a new one) lives in the address (?note=<id>) ────────
  const openNoteId = editorOpen ? (selectedNote ? selectedNote.id : NEW_NOTE) : null;
  const lastOpened = useRef<string | null>(null);
  lastOpened.current = openNoteId;
  useRecordInUrl('note', openNoteId, {
    ready: !isLoading && !error,
    openFromUrl: (id) => {
      if (id === NEW_NOTE) {
        setSelectedNote(null);
        setEditorOpen(true);
        return 'opened';
      }
      if (isLoading || error) return 'waiting';
      const note = notes.find((n) => n.id === id);
      if (!note) {
        toast.error('Note not found', {
          description: 'It may have been deleted, or it belongs to someone else.',
        });
        return 'missing';
      }
      setSelectedNote(note);
      setEditorOpen(true);
      return 'opened';
    },
    closeFromUrl: (previousId) => {
      if (previousId && lastOpened.current && lastOpened.current !== previousId) return;
      setEditorOpen(false);
      setSelectedNote(null);
    },
  });

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setSelectedNote(null);
  }, []);

  // Top-bar breadcrumb: Work / Notes / Active (/ the open note).
  const tabLabel =
    archiveFilter === 'archived' ? 'Archived' : archiveFilter === 'all' ? 'All' : 'Active';
  useBreadcrumbTrail(
    editorOpen
      ? [
          { label: tabLabel, onClick: closeEditor },
          { label: selectedNote ? selectedNote.title || 'Untitled note' : 'New note' },
        ]
      : [{ label: tabLabel }],
  );

  if (editorOpen) {
    // Keep the open note current as the list refetches (pin, archive, save).
    const current = selectedNote
      ? (notes.find((n) => n.id === selectedNote.id) ?? selectedNote)
      : null;
    return (
      <NoteEditorModal
        variant="page"
        isOpen
        backLabel="notes"
        onClose={closeEditor}
        note={current}
        personnelId={personnelId}
        personnelName={personnelName}
        clients={clientOptions}
        onSave={handleSave}
        onAutoSave={handleAutoSave}
        onDelete={(id) => {
          deleteNote.mutate(id);
        }}
        onConvertToTask={(id) => {
          convertToTask.mutate(id);
        }}
        onTogglePin={handlePin}
        onToggleArchive={handleArchive}
        customColourLabels={colourLabels.customLabels}
      />
    );
  }

  const isArchivedTab = archiveFilter === 'archived';

  return (
    <div className="space-y-5 p-6 lg:p-8">
      <PageHeader
        title="Notes"
        description="Your notes — link them to clients, turn them into tasks, keep them organised."
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleToggleSelecting}
              aria-pressed={isSelecting}
              disabled={isLoading || !!error}
            >
              <CheckSquare className="h-4 w-4" aria-hidden="true" />
              {isSelecting ? 'Exit select' : 'Select'}
            </Button>
            <Button onClick={handleNewNote}>
              <Plus className="h-4 w-4" aria-hidden="true" /> New note
            </Button>
          </>
        }
      />

      <Tabs
        value={archiveFilter}
        onValueChange={(v) => {
          setArchiveFilter(v as NoteArchiveFilter);
          setSelectedIds(new Set());
        }}
      >
        <NavTabsList aria-label="Notes views">
          <NavTabsTrigger value="active" count={isLoading || error ? undefined : stats.total}>
            Active
          </NavTabsTrigger>
          <NavTabsTrigger value="archived" count={isLoading || error ? undefined : stats.archived}>
            Archived
          </NavTabsTrigger>
          <NavTabsTrigger value="all" count={isLoading || error ? undefined : stats.all}>
            All
          </NavTabsTrigger>
        </NavTabsList>
      </Tabs>

      {isLoading ? (
        <div role="status" aria-label="Loading notes" className="space-y-5">
          <span className="sr-only">Loading notes…</span>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[92px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-9 w-full max-w-md rounded-md" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        </div>
      ) : error ? (
        <ErrorState
          title="Unable to load notes"
          description="Something went wrong while loading your notes. Nothing you entered was lost."
          onRetry={() => void refetch()}
          details={error instanceof Error ? error.message : undefined}
        />
      ) : (
        <>
          {archiveFilter === 'active' && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Total notes" value={stats.total} />
              <StatCard label="Pinned" value={stats.pinned} />
              <StatCard label="Client-linked" value={stats.linked} />
              <StatCard label="Converted to tasks" value={stats.converted} />
            </div>
          )}

          <NotesToolbar
            search={search}
            setSearch={setSearch}
            searchPlaceholder={isArchivedTab ? 'Search archived notes…' : 'Search notes…'}
            sortBy={sortBy}
            setSortBy={setSortBy}
            colorFilter={colorFilter}
            setColorFilter={setColorFilter}
            clientFilter={clientFilter}
            setClientFilter={setClientFilter}
            viewMode={viewMode}
            setViewMode={setViewMode}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            setColourLabelsOpen={setColourLabelsOpen}
            colourLabels={colourLabels}
            allTags={allTags}
            linkedClients={linkedClients}
            filtersActive={filtersActive}
            currentFilters={currentFilters}
            personnelId={personnelId}
            handleToggleTag={handleToggleTag}
            handleClearFilters={handleClearFilters}
            handleApplyPreset={handleApplyPreset}
          />

          {isSelecting && (
            <BulkActionsBar
              selectedCount={selectedIds.size}
              hasArchivedSelected={hasArchivedSelected}
              hasActiveSelected={hasActiveSelected}
              selectedNoteTags={selectedNoteTags}
              allTags={allTags}
              isBusy={isBulkBusy}
              onArchive={handleBulkArchive}
              onUnarchive={handleBulkUnarchive}
              onDelete={handleBulkDelete}
              onAddTag={handleBulkAddTag}
              onRemoveTag={handleBulkRemoveTag}
              onSetColor={handleBulkSetColor}
              onClearSelection={handleClearSelection}
              onSelectAll={handleSelectAll}
              totalCount={filteredNotes.length}
              getColourLabel={colourLabels.getLabel}
            />
          )}

          {filteredNotes.length === 0 ? (
            <EmptyState
              isSearch={filtersActive}
              isArchived={isArchivedTab}
              onNewNote={handleNewNote}
              onClearFilters={handleClearFilters}
            />
          ) : (
            <div className="space-y-6">
              {pinnedNotes.length > 0 && (
                <section aria-labelledby="notes-pinned" className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 id="notes-pinned" className="text-sm font-semibold text-nw-ink">
                      Pinned
                    </h2>
                    <span className="text-xs text-nw-text-3">{pinnedNotes.length}</span>
                    {!isSelecting && pinnedNotes.length > 1 && (
                      <span className="ml-2 flex items-center gap-1 text-xs text-nw-text-3">
                        <GripVertical className="h-3 w-3" aria-hidden="true" /> Drag to reorder
                      </span>
                    )}
                  </div>
                  <DraggablePinnedGrid
                    notes={pinnedNotes}
                    viewMode={viewMode}
                    handlers={cardHandlers}
                    personnelId={personnelId}
                    isSelecting={isSelecting}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                  />
                </section>
              )}

              {unpinnedNotes.length > 0 && (
                <section aria-labelledby="notes-all" className="space-y-3">
                  {pinnedNotes.length > 0 && (
                    <div className="flex items-center gap-2">
                      <h2 id="notes-all" className="text-sm font-semibold text-nw-ink">
                        All notes
                      </h2>
                      <span className="text-xs text-nw-text-3">{unpinnedNotes.length}</span>
                    </div>
                  )}
                  <NoteGrid
                    notes={unpinnedNotes}
                    viewMode={viewMode}
                    handlers={cardHandlers}
                    isSelecting={isSelecting}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                  />
                </section>
              )}
            </div>
          )}
        </>
      )}

      <ColourLabelsDialog
        isOpen={colourLabelsOpen}
        onClose={() => setColourLabelsOpen(false)}
        labels={colourLabels}
        personnelId={personnelId}
      />
    </div>
  );
}
