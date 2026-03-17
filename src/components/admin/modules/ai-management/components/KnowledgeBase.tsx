/**
 * KnowledgeBase — Knowledge Base tab
 *
 * Full CRUD interface for custom knowledge base entries.
 * Stat cards, filterable list, create/edit modals, status management.
 *
 * Guidelines: §7, §8.3
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search, Plus, Loader2, BookOpen, FileText, HelpCircle,
  Code, Shield, MessageCircleQuestion, MoreHorizontal,
  Pencil, Trash2, Archive, CheckCircle2, Clock, Eye,
  Filter, Inbox, Tag, Bot, ChevronDown,
} from 'lucide-react';
import { Input } from '../../../../ui/input';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../../ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import { cn } from '../../../../ui/utils';
import {
  useKBEntries, useKBStats, useCreateKBEntry, useUpdateKBEntry, useDeleteKBEntry,
} from '../hooks';
import { KB_ENTRY_TYPE_CONFIG, KB_STATUS_CONFIG, KB_DEFAULT_CATEGORIES } from '../constants';
import { KBEntryModal } from './KBEntryModal';
import type {
  KBEntry, KBEntryType, KBEntryStatus, CreateKBEntryInput, UpdateKBEntryInput, KBFilters,
} from '../types';

// ── Icon resolver for entry type ───────────────────────────────────────────
const TYPE_ICON_MAP: Record<string, React.ElementType> = {
  HelpCircle, FileText, Code, Shield, MessageCircleQuestion,
};
function resolveTypeIcon(slug: string): React.ElementType {
  return TYPE_ICON_MAP[slug] || FileText;
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, iconBg }: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={cn('p-2 rounded-lg', iconBg)}>
          <Icon className="h-4 w-4 text-gray-600" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export function KnowledgeBase() {
  const { data: entries, isLoading } = useKBEntries();
  const { data: stats } = useKBStats();
  const createEntry = useCreateKBEntry();
  const updateEntry = useUpdateKBEntry();
  const deleteEntry = useDeleteKBEntry();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KBEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<KBEntry | null>(null);
  const [previewEntry, setPreviewEntry] = useState<KBEntry | null>(null);

  // Filters
  const [filters, setFilters] = useState<KBFilters>({
    type: 'all',
    status: 'all',
    category: 'all',
    search: '',
  });

  // Filtered entries
  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter(entry => {
      if (filters.type !== 'all' && entry.type !== filters.type) return false;
      if (filters.status !== 'all' && entry.status !== filters.status) return false;
      if (filters.category !== 'all' && entry.category !== filters.category) return false;
      if (filters.search) {
        const lower = filters.search.toLowerCase();
        return (
          entry.title.toLowerCase().includes(lower) ||
          entry.content.toLowerCase().includes(lower) ||
          entry.category.toLowerCase().includes(lower) ||
          entry.tags.some(t => t.toLowerCase().includes(lower)) ||
          (entry.question?.toLowerCase().includes(lower) ?? false) ||
          (entry.answer?.toLowerCase().includes(lower) ?? false)
        );
      }
      return true;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [entries, filters]);

  // Collect unique categories from data
  const categories = useMemo(() => {
    if (!entries) return KB_DEFAULT_CATEGORIES as unknown as string[];
    const set = new Set<string>(KB_DEFAULT_CATEGORIES as unknown as string[]);
    entries.forEach(e => { if (e.category) set.add(e.category); });
    return Array.from(set).sort();
  }, [entries]);

  const handleCreate = useCallback(() => {
    setEditingEntry(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((entry: KBEntry) => {
    setEditingEntry(entry);
    setModalOpen(true);
  }, []);

  const handleModalSubmit = useCallback((data: CreateKBEntryInput | UpdateKBEntryInput) => {
    if (editingEntry) {
      updateEntry.mutate(
        { id: editingEntry.id, input: data as UpdateKBEntryInput },
        { onSuccess: () => setModalOpen(false) }
      );
    } else {
      createEntry.mutate(
        data as CreateKBEntryInput,
        { onSuccess: () => setModalOpen(false) }
      );
    }
  }, [editingEntry, updateEntry, createEntry]);

  const handleStatusChange = useCallback((entry: KBEntry, newStatus: KBEntryStatus) => {
    updateEntry.mutate({ id: entry.id, input: { status: newStatus } });
  }, [updateEntry]);

  const handleDelete = useCallback((entry: KBEntry) => {
    setDeleteConfirm(entry);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteConfirm) {
      deleteEntry.mutate(deleteConfirm.id, {
        onSuccess: () => setDeleteConfirm(null),
      });
    }
  }, [deleteConfirm, deleteEntry]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Entries"
          value={stats?.total ?? entries?.length ?? 0}
          icon={BookOpen}
          iconBg="bg-purple-50"
        />
        <StatCard
          label="Active"
          value={stats?.active ?? 0}
          icon={CheckCircle2}
          iconBg="bg-green-50"
        />
        <StatCard
          label="Draft"
          value={stats?.draft ?? 0}
          icon={Clock}
          iconBg="bg-gray-100"
        />
        <StatCard
          label="Archived"
          value={stats?.archived ?? 0}
          icon={Archive}
          iconBg="bg-amber-50"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search entries..."
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select
            value={filters.type || 'all'}
            onValueChange={(v) => setFilters(f => ({ ...f, type: v as KBEntryType | 'all' }))}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {(Object.keys(KB_ENTRY_TYPE_CONFIG) as KBEntryType[]).map(type => (
                <SelectItem key={type} value={type}>
                  {KB_ENTRY_TYPE_CONFIG[type].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.status || 'all'}
            onValueChange={(v) => setFilters(f => ({ ...f, status: v as KBEntryStatus | 'all' }))}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.category || 'all'}
            onValueChange={(v) => setFilters(f => ({ ...f, category: v }))}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleCreate}
            className="gap-2 bg-purple-600 hover:bg-purple-700 ml-auto"
          >
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          {filters.search || filters.type !== 'all' || filters.status !== 'all' || filters.category !== 'all'
            ? ' (filtered)'
            : ''
          }
        </p>
      </div>

      {/* Entry List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Inbox className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700 mb-1">
            {entries?.length === 0 ? 'No knowledge base entries yet' : 'No entries match your filters'}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            {entries?.length === 0
              ? 'Create your first entry to start building the AI knowledge base.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {entries?.length === 0 && (
            <Button onClick={handleCreate} className="gap-2 bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4" />
              Create First Entry
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onPreview={setPreviewEntry}
            />
          ))}
        </div>
      )}

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
            <AlertDialogTitle>Delete Knowledge Base Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{deleteConfirm?.title}"?
              This action cannot be undone. Consider archiving instead if you might need this content later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteEntry.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Modal */}
      {previewEntry && (
        <PreviewModal entry={previewEntry} onClose={() => setPreviewEntry(null)} />
      )}
    </div>
  );
}

// ── Entry Card ─────────────────────────────────────────────────────────────
function EntryCard({ entry, onEdit, onDelete, onStatusChange, onPreview }: {
  entry: KBEntry;
  onEdit: (entry: KBEntry) => void;
  onDelete: (entry: KBEntry) => void;
  onStatusChange: (entry: KBEntry, status: KBEntryStatus) => void;
  onPreview: (entry: KBEntry) => void;
}) {
  const typeCfg = KB_ENTRY_TYPE_CONFIG[entry.type];
  const statusCfg = KB_STATUS_CONFIG[entry.status];
  const TypeIcon = resolveTypeIcon(typeCfg.icon);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Type Icon */}
        <div className={cn('p-2.5 rounded-lg shrink-0', typeCfg.badgeClass.replace('text-', 'bg-').split(' ')[0])}>
          <TypeIcon className="h-5 w-5 text-current opacity-70" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{entry.title}</h3>
            <Badge className={cn('text-[10px] shrink-0', typeCfg.badgeClass)}>
              {typeCfg.label}
            </Badge>
            <Badge className={cn('text-[10px] shrink-0', statusCfg.badgeClass)}>
              <span className={cn('w-1.5 h-1.5 rounded-full mr-1 inline-block', statusCfg.dotClass)} />
              {statusCfg.label}
            </Badge>
          </div>

          {/* Preview text */}
          <p className="text-xs text-gray-500 line-clamp-2 mb-2">
            {entry.type === 'qa' ? (entry.question || entry.content) : entry.content}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {entry.category}
            </span>
            {entry.tags.length > 0 && (
              <span className="flex items-center gap-1">
                {entry.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">
                    {tag}
                  </span>
                ))}
                {entry.tags.length > 3 && (
                  <span className="text-gray-400">+{entry.tags.length - 3}</span>
                )}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              {entry.agentScope === 'all' ? 'All agents' : `${(entry.agentScope as string[]).length} agents`}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(entry.updatedAt).toLocaleDateString('en-ZA', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </span>
            <span className="text-gray-300">Priority: {entry.priority}/10</span>
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPreview(entry)} className="gap-2">
              <Eye className="h-3.5 w-3.5" /> Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(entry)} className="gap-2">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {entry.status === 'draft' && (
              <DropdownMenuItem onClick={() => onStatusChange(entry, 'active')} className="gap-2 text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Publish
              </DropdownMenuItem>
            )}
            {entry.status === 'active' && (
              <DropdownMenuItem onClick={() => onStatusChange(entry, 'archived')} className="gap-2 text-amber-600">
                <Archive className="h-3.5 w-3.5" /> Archive
              </DropdownMenuItem>
            )}
            {entry.status === 'archived' && (
              <DropdownMenuItem onClick={() => onStatusChange(entry, 'active')} className="gap-2 text-green-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Re-activate
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

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {entry.title}
            <Badge className={cn('text-[10px]', typeCfg.badgeClass)}>{typeCfg.label}</Badge>
            <Badge className={cn('text-[10px]', statusCfg.badgeClass)}>{statusCfg.label}</Badge>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-left space-y-4 mt-3">
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
                    {entry.type === 'qa' ? 'Additional Context' : 'Content'}
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{entry.content}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 pt-2 border-t">
                <div><span className="font-medium">Category:</span> {entry.category}</div>
                <div><span className="font-medium">Priority:</span> {entry.priority}/10</div>
                <div><span className="font-medium">Tags:</span> {entry.tags.join(', ') || 'None'}</div>
                <div><span className="font-medium">Scope:</span> {entry.agentScope === 'all' ? 'All agents' : (entry.agentScope as string[]).join(', ')}</div>
                <div><span className="font-medium">Created:</span> {new Date(entry.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                <div><span className="font-medium">Updated:</span> {new Date(entry.updatedAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>
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
