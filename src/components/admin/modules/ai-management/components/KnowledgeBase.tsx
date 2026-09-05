/**
 * KnowledgeBase — the Knowledge tab.
 *
 * Top: is what I see actually reaching Vasco? (KnowledgeSourcesPanel)
 * Below: the entries themselves, with one primary action (New entry), one
 * primary per-row control (the Live switch) and everything else behind a menu.
 *
 * Guidelines: §7, §8.3
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Loader2,
  FileText,
  HelpCircle,
  Code,
  Shield,
  MessageCircleQuestion,
  MoreHorizontal,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Eye,
  Inbox,
  Tag,
  Bot,
  Star,
} from 'lucide-react';
import { Input } from '../../../../ui/input';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Switch } from '../../../../ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { cn } from '../../../../ui/utils';
import {
  useKBEntries,
  useCreateKBEntry,
  useUpdateKBEntry,
  useDeleteKBEntry,
  useRagIndexStatus,
  useTriggerReindex,
} from '../hooks';
import {
  KB_ENTRY_TYPE_CONFIG,
  KB_STATUS_CONFIG,
  KB_DEFAULT_CATEGORIES,
  KB_IMPORTANCE_OPTIONS,
  importanceFromPriority,
} from '../constants';
import { formatDate } from '../format';
import { KBEntryModal } from './KBEntryModal';
import { KnowledgeSourcesPanel } from './KnowledgeSourcesPanel';
import type {
  KBEntry,
  KBEntryType,
  KBEntryStatus,
  CreateKBEntryInput,
  UpdateKBEntryInput,
} from '../types';

// ── Icon resolver for entry type ───────────────────────────────────────────
const TYPE_ICON_MAP: Record<string, React.ElementType> = {
  HelpCircle,
  FileText,
  Code,
  Shield,
  MessageCircleQuestion,
};
function resolveTypeIcon(slug: string): React.ElementType {
  return TYPE_ICON_MAP[slug] || FileText;
}

type StatusFilter = KBEntryStatus | 'all';
const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Live' },
  { id: 'draft', label: 'Draft' },
  { id: 'archived', label: 'Archived' },
];

export function KnowledgeBase() {
  const { data: entries, isLoading } = useKBEntries();
  const { data: indexStatus, isLoading: indexLoading } = useRagIndexStatus();
  const rebuild = useTriggerReindex();
  const createEntry = useCreateKBEntry();
  const updateEntry = useUpdateKBEntry();
  const deleteEntry = useDeleteKBEntry();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KBEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<KBEntry | null>(null);
  const [previewEntry, setPreviewEntry] = useState<KBEntry | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<KBEntryType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, active: 0, draft: 0, archived: 0 };
    for (const e of entries ?? []) {
      c.all++;
      c[e.status]++;
    }
    return c;
  }, [entries]);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const lower = search.trim().toLowerCase();
    return entries
      .filter((entry) => {
        if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
        if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
        if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
        if (lower) {
          return (
            entry.title.toLowerCase().includes(lower) ||
            entry.content.toLowerCase().includes(lower) ||
            entry.category.toLowerCase().includes(lower) ||
            entry.tags.some((t) => t.toLowerCase().includes(lower)) ||
            (entry.question?.toLowerCase().includes(lower) ?? false) ||
            (entry.answer?.toLowerCase().includes(lower) ?? false)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [entries, search, statusFilter, typeFilter, categoryFilter]);

  const categories = useMemo(() => {
    const set = new Set<string>(KB_DEFAULT_CATEGORIES as unknown as string[]);
    entries?.forEach((e) => e.category && set.add(e.category));
    return Array.from(set).sort();
  }, [entries]);

  const isFiltered =
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    categoryFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setCategoryFilter('all');
  };

  const handleCreate = useCallback(() => {
    setEditingEntry(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((entry: KBEntry) => {
    setEditingEntry(entry);
    setModalOpen(true);
  }, []);

  const handleModalSubmit = useCallback(
    (data: CreateKBEntryInput | UpdateKBEntryInput) => {
      if (editingEntry) {
        updateEntry.mutate(
          { id: editingEntry.id, input: data as UpdateKBEntryInput },
          { onSuccess: () => setModalOpen(false) },
        );
      } else {
        createEntry.mutate(data as CreateKBEntryInput, { onSuccess: () => setModalOpen(false) });
      }
    },
    [editingEntry, updateEntry, createEntry],
  );

  const handleStatusChange = useCallback(
    (entry: KBEntry, newStatus: KBEntryStatus) => {
      updateEntry.mutate({ id: entry.id, input: { status: newStatus } });
    },
    [updateEntry],
  );

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      deleteEntry.mutate(deleteConfirm.id, { onSuccess: () => setDeleteConfirm(null) });
    }
  }, [deleteConfirm, deleteEntry]);

  return (
    <div className="space-y-6">
      <KnowledgeSourcesPanel
        status={indexStatus}
        isLoading={indexLoading}
        onRebuild={() => rebuild.mutate()}
        isRebuilding={rebuild.isPending}
      />

      {/* Toolbar */}
      <section className="space-y-3" aria-label="Knowledge base entries">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Knowledge base entries</h2>
            <p className="text-xs text-gray-500">
              Facts you want Vasco to know that are not in a published article: fees, office hours,
              product rules, house views. Switch an entry to Live and Vasco can use it straight
              away.
            </p>
          </div>
          <Button
            onClick={handleCreate}
            className="gap-2 bg-purple-600 hover:bg-purple-700 lg:ml-auto shrink-0"
          >
            <Plus className="h-4 w-4" />
            New entry
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search entries"
            />
          </div>

          <div
            className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 self-start"
            role="group"
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                aria-pressed={statusFilter === f.id}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  statusFilter === f.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900',
                )}
              >
                {f.label}
                <span className="ml-1 text-gray-400 tabular-nums">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as KBEntryType | 'all')}>
            <SelectTrigger className="w-full lg:w-[150px]" aria-label="Filter by format">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All formats</SelectItem>
              {(Object.keys(KB_ENTRY_TYPE_CONFIG) as KBEntryType[]).map((type) => (
                <SelectItem key={type} value={type}>
                  {KB_ENTRY_TYPE_CONFIG[type].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full lg:w-[180px]" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            {isFiltered ? ' match' : ''}
          </span>
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-purple-700 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Entry List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <Inbox className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 mb-1">
              {entries?.length === 0 ? 'No entries yet' : 'No entries match these filters'}
            </p>
            <p className="text-xs text-gray-500 mb-4 max-w-md mx-auto">
              {entries?.length === 0
                ? 'Add the facts you want Vasco to know. Anything you mark Live is used in answers immediately; published articles are already covered.'
                : 'Try a different search or clear the filters.'}
            </p>
            {entries?.length === 0 ? (
              <Button onClick={handleCreate} className="gap-2 bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4" />
                Add your first entry
              </Button>
            ) : (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onEdit={handleEdit}
                onDelete={setDeleteConfirm}
                onStatusChange={handleStatusChange}
                onPreview={setPreviewEntry}
                isUpdating={updateEntry.isPending}
              />
            ))}
          </div>
        )}
      </section>

      {/* Create/Edit Modal */}
      <KBEntryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        entry={editingEntry}
        onSubmit={handleModalSubmit}
        isSubmitting={createEntry.isPending || updateEntry.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteConfirm?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the entry permanently and Vasco stops using it immediately. If you might
              want it back later, archive it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              {deleteEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Modal */}
      {previewEntry && <PreviewModal entry={previewEntry} onClose={() => setPreviewEntry(null)} />}
    </div>
  );
}

// ── Entry Card ─────────────────────────────────────────────────────────────
function EntryCard({
  entry,
  onEdit,
  onDelete,
  onStatusChange,
  onPreview,
  isUpdating,
}: {
  entry: KBEntry;
  onEdit: (entry: KBEntry) => void;
  onDelete: (entry: KBEntry) => void;
  onStatusChange: (entry: KBEntry, status: KBEntryStatus) => void;
  onPreview: (entry: KBEntry) => void;
  isUpdating: boolean;
}) {
  const typeCfg = KB_ENTRY_TYPE_CONFIG[entry.type];
  const statusCfg = KB_STATUS_CONFIG[entry.status];
  const TypeIcon = resolveTypeIcon(typeCfg.icon);
  const importance = importanceFromPriority(entry.priority);
  const importanceCfg = KB_IMPORTANCE_OPTIONS.find((o) => o.id === importance);
  const isLive = entry.status === 'active';
  const scopedTo = entry.agentScope === 'all' ? null : (entry.agentScope as string[]);

  return (
    <div
      className={cn(
        'bg-white rounded-xl border shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow',
        isLive ? 'border-gray-100' : 'border-gray-100 opacity-80',
      )}
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg shrink-0 bg-gray-100">
          <TypeIcon className="h-5 w-5 text-gray-600" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{entry.title}</h3>
            <Badge className={cn('text-[10px] shrink-0', statusCfg.badgeClass)}>
              <span
                className={cn('w-1.5 h-1.5 rounded-full mr-1 inline-block', statusCfg.dotClass)}
              />
              {statusCfg.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] shrink-0 text-gray-600">
              {typeCfg.label}
            </Badge>
          </div>

          <p className="text-xs text-gray-500 line-clamp-2 mb-2">
            {entry.type === 'qa' ? entry.question || entry.content : entry.content}
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span className="inline-flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {entry.category}
            </span>
            <span>Updated {formatDate(entry.updatedAt)}</span>
            {importance !== 'normal' && importanceCfg && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <Star className="h-3 w-3" />
                {importanceCfg.label} importance
              </span>
            )}
            {scopedTo && (
              <span className="inline-flex items-center gap-1">
                <Bot className="h-3 w-3" />
                Only {scopedTo.length} {scopedTo.length === 1 ? 'assistant' : 'assistants'}
              </span>
            )}
            {entry.tags.length > 0 && (
              <span className="inline-flex items-center gap-1">
                {entry.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]"
                  >
                    {tag}
                  </span>
                ))}
                {entry.tags.length > 3 && <span>+{entry.tags.length - 3}</span>}
              </span>
            )}
          </div>
        </div>

        {/* Primary control: Live switch */}
        {entry.status !== 'archived' && (
          <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
            <span className="text-xs font-medium text-gray-600 hidden sm:inline">Live</span>
            <Switch
              checked={isLive}
              disabled={isUpdating}
              onCheckedChange={(checked) => onStatusChange(entry, checked ? 'active' : 'draft')}
              aria-label={`${entry.title}: available to Vasco`}
            />
          </label>
        )}

        {/* Everything else */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              aria-label={`More actions for ${entry.title}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(entry)} className="gap-2">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPreview(entry)} className="gap-2">
              <Eye className="h-3.5 w-3.5" /> Preview
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {entry.status === 'archived' ? (
              <DropdownMenuItem
                onClick={() => onStatusChange(entry, 'active')}
                className="gap-2 text-green-700"
              >
                <ArchiveRestore className="h-3.5 w-3.5" /> Restore and make live
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => onStatusChange(entry, 'archived')}
                className="gap-2 text-amber-700"
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(entry)}
              className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ── Preview Modal ──────────────────────────────────────────────────────────
function PreviewModal({ entry, onClose }: { entry: KBEntry; onClose: () => void }) {
  const typeCfg = KB_ENTRY_TYPE_CONFIG[entry.type];
  const statusCfg = KB_STATUS_CONFIG[entry.status];
  const importanceCfg = KB_IMPORTANCE_OPTIONS.find(
    (o) => o.id === importanceFromPriority(entry.priority),
  );

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex flex-wrap items-center gap-2">
            {entry.title}
            <Badge variant="outline" className="text-[10px]">
              {typeCfg.label}
            </Badge>
            <Badge className={cn('text-[10px]', statusCfg.badgeClass)}>{statusCfg.label}</Badge>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-left space-y-4 mt-3">
              <p className="text-xs text-gray-500">
                This is the text Vasco can quote from when the entry is Live.
              </p>
              {entry.type === 'qa' && entry.question && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-600 mb-1">Question</p>
                  <p className="text-sm text-gray-800">{entry.question}</p>
                </div>
              )}
              {entry.type === 'qa' && entry.answer && (
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <p className="text-xs font-semibold text-green-600 mb-1">Answer</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.answer}</p>
                </div>
              )}
              {entry.content && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    {entry.type === 'qa' ? 'Extra context' : 'Content'}
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.content}</p>
                  </div>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-3 text-xs text-gray-500 pt-2 border-t">
                <div>
                  <dt className="font-medium inline">Category:</dt>{' '}
                  <dd className="inline">{entry.category}</dd>
                </div>
                <div>
                  <dt className="font-medium inline">Importance:</dt>{' '}
                  <dd className="inline">{importanceCfg?.label ?? 'Normal'}</dd>
                </div>
                <div>
                  <dt className="font-medium inline">Tags:</dt>{' '}
                  <dd className="inline">{entry.tags.join(', ') || 'None'}</dd>
                </div>
                <div>
                  <dt className="font-medium inline">Assistants:</dt>{' '}
                  <dd className="inline">
                    {entry.agentScope === 'all' ? 'All' : (entry.agentScope as string[]).join(', ')}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium inline">Created:</dt>{' '}
                  <dd className="inline">{formatDate(entry.createdAt)}</dd>
                </div>
                <div>
                  <dt className="font-medium inline">Updated:</dt>{' '}
                  <dd className="inline">{formatDate(entry.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
