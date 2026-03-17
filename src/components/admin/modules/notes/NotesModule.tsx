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

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import type { Note, NoteColor, NoteViewMode, NoteArchiveFilter, NoteSortBy, CreateNoteInput, UpdateNoteInput } from './types';
import { NOTE_COLOR_CONFIG, NOTE_COLORS, NOTE_SORT_OPTIONS } from './constants';
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useConvertNoteToTask,
  useColourLabels,
} from './hooks';
import { NoteCard } from './components/NoteCard';
import { NoteEditorModal } from './components/NoteEditorModal';
import { NotesSkeleton } from './components/NotesSkeleton';
import { BulkActionsBar } from './components/BulkActionsBar';
import { FilterPresetBar } from './components/FilterPresetBar';
import type { CurrentFilterState } from './components/FilterPresetBar';
import { DraggablePinnedGrid } from './components/DraggablePinnedGrid';
import { ColourLabelsDialog } from './components/ColourLabelsDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clientKeys, noteKeys } from '../../../../utils/queryKeys';
import { api } from '../../../../utils/api/client';
import { NotesAPI } from './api';
import { toast } from 'sonner@2.0.3';

import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Badge } from '../../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  StickyNote,
  Pin,
  CheckCircle2,
  User,
  ArrowUpDown,
  Tag,
  X,
  FolderOpen,
  CheckSquare,
  GripVertical,
  Palette,
} from 'lucide-react';

// ============================================================================
// SORT UTILITY (§7.1 — pure utility, no UI coupling)
// ============================================================================

function sortNotes(notes: Note[], sortBy: NoteSortBy): Note[] {
  return [...notes].sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title, 'en', { sensitivity: 'base' });
      case 'createdAt':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'updatedAt':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NotesModule() {
  const { user } = useAuth();
  const personnelId = user?.id || '';
  const personnelName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Admin';
  const queryClient = useQueryClient();

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: notes = [], isLoading } = useNotes(personnelId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const convertToTask = useConvertNoteToTask();

  // ── Colour Labels (personnel-scoped custom descriptions) ─────────────────
  const colourLabels = useColourLabels(personnelId);
  const [colourLabelsOpen, setColourLabelsOpen] = useState(false);

  // Fetch clients for linking dropdown
  const { data: clientsResponse } = useQuery({
    queryKey: clientKeys.lists(),
    queryFn: () => api.get<{ clients: Array<{ id: string; firstName?: string; lastName?: string }> }>('/clients'),
    staleTime: 5 * 60 * 1000,
  });

  const clientOptions = useMemo(() => {
    const clients = clientsResponse?.clients;
    if (!Array.isArray(clients)) return [];
    return clients
      .filter((c) => c.id && (c.firstName || c.lastName))
      .map((c) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' '),
      }));
  }, [clientsResponse]);

  // ── UI State: Filters ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<NoteViewMode>('grid');
  const [archiveFilter, setArchiveFilter] = useState<NoteArchiveFilter>('active');
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
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [notes]);

  // ── Derived: Active filter count ──────────────────────────────────────────
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (colorFilter !== 'all') count++;
    if (archiveFilter !== 'active') count++;
    if (selectedTags.length > 0) count++;
    if (clientFilter !== 'all') count++;
    return count;
  }, [colorFilter, archiveFilter, selectedTags, clientFilter]);

  // ── Derived: Current filter state (for presets) ───────────────────────────
  const currentFilters: CurrentFilterState = useMemo(() => ({
    search,
    archiveFilter,
    colorFilter,
    sortBy,
    selectedTags,
    clientFilter,
  }), [search, archiveFilter, colorFilter, sortBy, selectedTags, clientFilter]);

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
      result = result.filter((n) =>
        selectedTags.every((tag) => n.tags.includes(tag))
      );
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
          (n.clientName && n.clientName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [notes, archiveFilter, colorFilter, selectedTags, clientFilter, search]);

  // Separate pinned and unpinned, then sort each group
  const { pinnedNotes, unpinnedNotes } = useMemo(() => {
    const pinned = sortNotes(filteredNotes.filter((n) => n.isPinned), sortBy);
    const unpinned = sortNotes(filteredNotes.filter((n) => !n.isPinned), sortBy);
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
    };
  }, [notes]);

  // ── Derived: Bulk action data ─────────────────────────────────────────────
  const selectedNotes = useMemo(() =>
    filteredNotes.filter((n) => selectedIds.has(n.id)),
    [filteredNotes, selectedIds]
  );

  const selectedNoteTags = useMemo(() => {
    const tagSet = new Set<string>();
    selectedNotes.forEach((n) => n.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [selectedNotes]);

  const hasArchivedSelected = selectedNotes.some((n) => n.isArchived);
  const hasActiveSelected = selectedNotes.some((n) => !n.isArchived);

  // ── Handlers: Notes ───────────────────────────────────────────────────────
  const handleOpenNote = useCallback((note: Note) => {
    if (isSelecting) return; // In select mode, clicks toggle selection
    setSelectedNote(note);
    setEditorOpen(true);
  }, [isSelecting]);

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
    (note: Note) => {
      updateNote.mutate({ id: note.id, isPinned: !note.isPinned });
    },
    [updateNote]
  );

  const handleArchive = useCallback(
    (note: Note) => {
      updateNote.mutate({ id: note.id, isArchived: !note.isArchived });
    },
    [updateNote]
  );

  const handleDelete = useCallback(
    (note: Note) => {
      deleteNote.mutate(note.id);
    },
    [deleteNote]
  );

  const handleConvertToTask = useCallback(
    (note: Note) => {
      convertToTask.mutate(note.id);
    },
    [convertToTask]
  );

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleClearFilters = useCallback(() => {
    setColorFilter('all');
    setArchiveFilter('active');
    setSelectedTags([]);
    setClientFilter('all');
    setSearch('');
  }, []);

  // ── Handlers: Filter Presets ──────────────────────────────────────────────
  const handleApplyPreset = useCallback((filters: CurrentFilterState) => {
    setSearch(filters.search);
    setArchiveFilter(filters.archiveFilter);
    setColorFilter(filters.colorFilter);
    setSortBy(filters.sortBy);
    setSelectedTags(filters.selectedTags);
    setClientFilter(filters.clientFilter);
  }, []);

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

  const handleBulkAddTag = useCallback(async (tag: string) => {
    // Add tag to all selected notes that don't already have it
    const targets = selectedNotes.filter((n) => !n.tags.includes(tag));
    if (targets.length === 0) {
      toast.info(`All selected notes already have tag "${tag}"`);
      return;
    }
    setIsBulkBusy(true);
    try {
      await Promise.all(targets.map((n) =>
        NotesAPI.updateNote({ id: n.id, tags: [...n.tags, tag] })
      ));
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
      toast.success(`Tag "${tag}" added to ${targets.length} note${targets.length > 1 ? 's' : ''}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to add tag', { description: msg });
    } finally {
      setIsBulkBusy(false);
    }
  }, [selectedNotes, queryClient]);

  const handleBulkRemoveTag = useCallback(async (tag: string) => {
    const targets = selectedNotes.filter((n) => n.tags.includes(tag));
    if (targets.length === 0) return;
    setIsBulkBusy(true);
    try {
      await Promise.all(targets.map((n) =>
        NotesAPI.updateNote({ id: n.id, tags: n.tags.filter((t) => t !== tag) })
      ));
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
      toast.success(`Tag "${tag}" removed from ${targets.length} note${targets.length > 1 ? 's' : ''}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to remove tag', { description: msg });
    } finally {
      setIsBulkBusy(false);
    }
  }, [selectedNotes, queryClient]);

  const handleBulkSetColor = useCallback(async (color: NoteColor) => {
    const targets = selectedNotes.filter((n) => n.color !== color);
    if (targets.length === 0) {
      toast.info('All selected notes already have that colour');
      return;
    }
    setIsBulkBusy(true);
    try {
      await Promise.all(targets.map((n) =>
        NotesAPI.updateNote({ id: n.id, color })
      ));
      queryClient.invalidateQueries({ queryKey: noteKeys.all });
      toast.success(`Colour updated for ${targets.length} note${targets.length > 1 ? 's' : ''}`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to update colour', { description: msg });
    } finally {
      setIsBulkBusy(false);
    }
  }, [selectedNotes, queryClient]);

  // ── Silent auto-save handler ─────────────────────────────────────────────
  const handleAutoSave = useCallback(
    async (input: UpdateNoteInput) => {
      await NotesAPI.updateNote(input);
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(input.id) });
    },
    [queryClient]
  );

  // ── Note card handlers bundle ─────────────────────────────────────────────
  const cardHandlers = useMemo(() => ({
    onOpen: handleOpenNote,
    onPin: handlePin,
    onArchive: handleArchive,
    onDelete: handleDelete,
    onConvertToTask: handleConvertToTask,
  }), [handleOpenNote, handlePin, handleArchive, handleDelete, handleConvertToTask]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return <NotesSkeleton />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Your personal notes — link to clients, convert to tasks, stay organised.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isSelecting ? 'default' : 'outline'}
            size="sm"
            className={`gap-1.5 text-xs h-9 ${isSelecting ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
            onClick={handleToggleSelecting}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            {isSelecting ? 'Exit Select' : 'Select'}
          </Button>
          <Button onClick={handleNewNote} className="bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="h-4 w-4 mr-1" /> New Note
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={StickyNote} label="Total Notes" value={stats.total} iconBg="bg-gray-50" iconColor="text-gray-500" />
        <StatCard icon={Pin} label="Pinned" value={stats.pinned} iconBg="bg-amber-50" iconColor="text-amber-500" />
        <StatCard icon={User} label="Client Linked" value={stats.linked} iconBg="bg-purple-50" iconColor="text-purple-500" />
        <StatCard icon={CheckCircle2} label="Converted" value={stats.converted} iconBg="bg-green-50" iconColor="text-green-500" />
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Primary toolbar row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as NoteSortBy)}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {NOTE_SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Archive filter */}
          <Select value={archiveFilter} onValueChange={(v) => setArchiveFilter(v as NoteArchiveFilter)}>
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>

          {/* Colour filter */}
          <div className="flex items-center gap-1">
            <Select value={colorFilter} onValueChange={(v) => setColorFilter(v as NoteColor | 'all')}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="All colours" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Colours</SelectItem>
                {NOTE_COLORS.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${NOTE_COLOR_CONFIG[c].dot}`} />
                      {colourLabels.getLabel(c)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-gray-400 hover:text-purple-600"
              onClick={() => setColourLabelsOpen(true)}
              title="Customise colour labels"
            >
              <Palette className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Client filter */}
          {linkedClients.length > 0 && (
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <SelectValue placeholder="All Clients" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="__unlinked__">Unlinked</SelectItem>
                {linkedClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* View toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 px-2.5 rounded-r-none ${viewMode === 'grid' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className={`h-8 px-2.5 rounded-l-none ${viewMode === 'list' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Result count & clear filters */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
            </Badge>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700"
                onClick={handleClearFilters}
              >
                <X className="h-3 w-3 mr-1" />
                Clear filters ({activeFilterCount})
              </Button>
            )}
          </div>
        </div>

        {/* Saved presets + tag bar row */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Saved filter presets */}
          <FilterPresetBar
            personnelId={personnelId}
            currentFilters={currentFilters}
            onApplyPreset={handleApplyPreset}
          />

          {/* Tag bar — only shown when tags exist */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <Tag className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              {allTags.map((tag) => {
                const isActive = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                      isActive
                        ? 'bg-purple-100 text-purple-800 border-purple-300 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {tag}
                    {isActive && <X className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })}
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 ml-1"
                >
                  Clear tags
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Notes Content ──────────────────────────────────────────────────── */}
      {filteredNotes.length === 0 ? (
        <EmptyState
          isSearch={!!search.trim() || colorFilter !== 'all' || archiveFilter !== 'active' || selectedTags.length > 0 || clientFilter !== 'all'}
          onNewNote={handleNewNote}
        />
      ) : (
        <div className="space-y-6">
          {/* Pinned section — with drag-and-drop reordering */}
          {pinnedNotes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Pinned
                </h2>
                <span className="text-[10px] text-gray-400">({pinnedNotes.length})</span>
                {!isSelecting && pinnedNotes.length > 1 && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-1 ml-2">
                    <GripVertical className="h-3 w-3" /> Drag to reorder
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
            </div>
          )}

          {/* Unpinned notes section */}
          {unpinnedNotes.length > 0 && (
            <div className="space-y-3">
              {pinnedNotes.length > 0 && (
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5 text-gray-400" />
                  <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    All Notes
                  </h2>
                  <span className="text-[10px] text-gray-400">({unpinnedNotes.length})</span>
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
            </div>
          )}
        </div>
      )}

      {/* ── Bulk Actions Bar (floating) ────────────────────────────────────── */}
      {isSelecting && selectedIds.size > 0 && (
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

      {/* ── Editor Modal ───────────────────────────────────────────────────── */}
      <NoteEditorModal
        isOpen={editorOpen}
        onClose={() => { setEditorOpen(false); setSelectedNote(null); }}
        note={selectedNote}
        personnelId={personnelId}
        personnelName={personnelName}
        clients={clientOptions}
        onSave={handleSave}
        onAutoSave={handleAutoSave}
        onDelete={(id) => { deleteNote.mutate(id); }}
        onConvertToTask={(id) => { convertToTask.mutate(id); }}
        customColourLabels={colourLabels.customLabels}
      />

      {/* ── Colour Labels Dialog ───────────────────────────────────────────── */}
      <ColourLabelsDialog
        isOpen={colourLabelsOpen}
        onClose={() => setColourLabelsOpen(false)}
        labels={colourLabels}
        personnelId={personnelId}
      />
    </div>
  );
}

// ============================================================================
// INTERNAL COMPONENTS
// ============================================================================

/** Note grid/list renderer (for unpinned notes — no drag-and-drop) */
function NoteGrid({
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

function StatCard({
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

function EmptyState({
  isSearch,
  onNewNote,
}: {
  isSearch: boolean;
  onNewNote: () => void;
}) {
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