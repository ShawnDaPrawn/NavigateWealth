/**
 * Publications — Articles List View (Enhanced)
 *
 * Multi-view articles list with:
 * - Table view (default) and card grid view toggle
 * - Bulk selection and batch actions
 * - Advanced filtering with active filter pills
 * - Sort controls
 * - Inline quick-status actions
 * - Polished empty and zero-result states
 *
 * @module publications/ArticlesListView
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import {
  PlusCircle,
  Filter,
  Edit,
  Eye,
  Copy,
  Archive,
  Trash2,
  Calendar,
  Clock,
  Star,
  FileText,
  LayoutGrid,
  LayoutList,
  ChevronDown,
  X,
  ArrowUpDown,
  CheckSquare,
  Square,
  Loader2,
  Send,
  Search,
  User,
} from 'lucide-react';
import { cn } from '../../../ui/utils';

// Hooks & components
import { useArticles, useCategories, useArticleActions } from './hooks';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';
import { StatusBadge } from './components/StatusBadge';
import { ConfirmDialog, useConfirmDialog } from './components/ConfirmDialog';
import { formatDate, getRelativeTime, truncateText } from './utils';
import type { Article, ArticleStatus } from './types';
import { toast } from 'sonner@2.0.3';

interface ArticlesListViewProps {
  onCreateNew: () => void;
  onEditArticle: (article: Article) => void;
}

type ViewMode = 'table' | 'cards';
type SortField = 'updated_at' | 'created_at' | 'title' | 'view_count' | 'published_at';
type SortDir = 'asc' | 'desc';

export function ArticlesListView({ onCreateNew, onEditArticle }: ArticlesListViewProps) {
  // ── Data ─────────────────────────────────────────────────────────────
  const { articles, isLoading, error, refetch } = useArticles();
  const { categories } = useCategories({ activeOnly: true });

  // ── View state ───────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Bulk selection ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Actions ──────────────────────────────────────────────────────────
  const { handleDuplicate, handleDelete, handleArchive, isProcessing } = useArticleActions({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err),
    onDelete: () => refetch(),
  });

  const confirmDialog = useConfirmDialog();

  // ── Helpers ──────────────────────────────────────────────────────────
  const getCategoryName = useCallback(
    (id: string) => categories.find(c => c.id === id)?.name || 'Unknown',
    [categories],
  );

  // ── Filter + sort ────────────────────────────────────────────────────
  const filteredArticles = useMemo(() => {
    let list = articles;

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.excerpt?.toLowerCase().includes(q) ||
          a.subtitle?.toLowerCase().includes(q),
      );
    }

    // Filters
    if (selectedStatus) list = list.filter(a => a.status === selectedStatus);
    if (selectedCategory) list = list.filter(a => a.category_id === selectedCategory);

    // Sort
    list = [...list].sort((a, b) => {
      // Featured articles always sort to the top
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;

      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'view_count':
          aVal = a.view_count || 0;
          bVal = b.view_count || 0;
          break;
        case 'published_at':
          aVal = a.published_at ? new Date(a.published_at).getTime() : 0;
          bVal = b.published_at ? new Date(b.published_at).getTime() : 0;
          break;
        case 'created_at':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        default:
          aVal = new Date(a.updated_at).getTime();
          bVal = new Date(b.updated_at).getTime();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [articles, searchQuery, selectedStatus, selectedCategory, sortField, sortDir]);

  // ── Active filter count ──────────────────────────────────────────────
  const activeFilterCount = [selectedStatus, selectedCategory].filter(Boolean).length;

  // ── Bulk actions ─────────────────────────────────────────────────────
  const allSelected = filteredArticles.length > 0 && selectedIds.size === filteredArticles.length;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredArticles.map(a => a.id)));
    }
  }, [allSelected, filteredArticles]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkArchive = useCallback(() => {
    confirmDialog.open({
      title: 'Archive Selected',
      description: `Are you sure you want to archive ${selectedIds.size} article(s)?`,
      onConfirm: async () => {
        for (const id of selectedIds) {
          await handleArchive(id);
        }
        setSelectedIds(new Set());
      },
    });
  }, [selectedIds, handleArchive, confirmDialog]);

  const handleBulkDelete = useCallback(() => {
    confirmDialog.open({
      title: 'Delete Selected',
      description: `Are you sure you want to permanently delete ${selectedIds.size} article(s)? This cannot be undone.`,
      onConfirm: async () => {
        for (const id of selectedIds) {
          await handleDelete(id);
        }
        setSelectedIds(new Set());
      },
    });
  }, [selectedIds, handleDelete, confirmDialog]);

  // ── Sort toggle ──────────────────────────────────────────────────────
  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  // ── Stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    published: articles.filter(a => a.status === 'published').length,
    draft: articles.filter(a => a.status === 'draft').length,
    scheduled: articles.filter(a => a.status === 'scheduled').length,
    featured: articles.filter(a => a.is_featured).length,
  }), [articles]);

  // ── Loading / error ──────────────────────────────────────────────────
  if (isLoading) return <LoadingState message="Loading articles..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Stat pills ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatPill
          label="Published"
          count={stats.published}
          active={selectedStatus === 'published'}
          onClick={() => setSelectedStatus(s => (s === 'published' ? '' : 'published'))}
          color="green"
        />
        <StatPill
          label="Drafts"
          count={stats.draft}
          active={selectedStatus === 'draft'}
          onClick={() => setSelectedStatus(s => (s === 'draft' ? '' : 'draft'))}
          color="gray"
        />
        <StatPill
          label="Scheduled"
          count={stats.scheduled}
          active={selectedStatus === 'scheduled'}
          onClick={() => setSelectedStatus(s => (s === 'scheduled' ? '' : 'scheduled'))}
          color="blue"
        />
        <StatPill
          label="Featured"
          count={stats.featured}
          color="amber"
        />
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Actions row */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Filter toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(f => !f)}
                className={cn('gap-1.5', showFilters && 'bg-purple-50 border-purple-200 text-purple-700')}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 bg-purple-600 text-white text-[10px] px-1.5 py-0 h-4">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              {/* Sort */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSort(sortField)}
                className="gap-1.5"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden md:inline">
                  {sortField === 'updated_at' ? 'Modified' : sortField === 'title' ? 'Title' : sortField === 'view_count' ? 'Views' : 'Date'}
                </span>
                <span className="text-[10px] text-muted-foreground">{sortDir === 'asc' ? 'A-Z' : 'Z-A'}</span>
              </Button>

              {/* View toggle */}
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'p-1.5 transition-colors',
                    viewMode === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600',
                  )}
                  aria-label="Table view"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'p-1.5 transition-colors',
                    viewMode === 'cards' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600',
                  )}
                  aria-label="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>

              <Button onClick={onCreateNew} size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700">
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </div>
          </div>

          {/* ── Filter panel ──────────────────────────────────────── */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FilterSelect
                  label="Status"
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  options={[
                    { value: '', label: 'All Status' },
                    { value: 'published', label: 'Published' },
                    { value: 'draft', label: 'Draft' },
                    { value: 'in_review', label: 'In Review' },
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'archived', label: 'Archived' },
                  ]}
                />
                <FilterSelect
                  label="Category"
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  options={[
                    { value: '', label: 'All Categories' },
                    ...categories.map(c => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>
              {activeFilterCount > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">Active:</span>
                  {selectedStatus && (
                    <FilterPill label={selectedStatus.replace('_', ' ')} onClear={() => setSelectedStatus('')} />
                  )}
                  {selectedCategory && (
                    <FilterPill label={getCategoryName(selectedCategory)} onClear={() => setSelectedCategory('')} />
                  )}
                  <button
                    onClick={() => { setSelectedStatus(''); setSelectedCategory(''); }}
                    className="text-xs text-purple-600 hover:text-purple-800 ml-1"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Bulk action bar ───────────────────────────────────── */}
          {selectedIds.size > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-700">
                {selectedIds.size} selected
              </span>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBulkArchive} disabled={isProcessing}>
                <Archive className="h-3.5 w-3.5" />
                Archive
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red-600 hover:bg-red-50 border-red-200"
                onClick={handleBulkDelete}
                disabled={isProcessing}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-muted-foreground hover:text-gray-700 ml-auto"
              >
                Deselect all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Results ───────────────────────────────────────────────── */}
      <div className="text-xs text-muted-foreground flex items-center justify-between">
        <span>
          {filteredArticles.length === articles.length
            ? `${articles.length} articles`
            : `${filteredArticles.length} of ${articles.length} articles`}
        </span>
      </div>

      {/* ── Empty state ───────────────────────────────────────────── */}
      {filteredArticles.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {articles.length === 0 ? 'No articles yet' : 'No matching articles'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
              {articles.length === 0
                ? 'Create your first article to start building your content library.'
                : 'Try adjusting your filters or search query.'}
            </p>
            {articles.length === 0 && (
              <Button onClick={onCreateNew} className="gap-2 bg-purple-600 hover:bg-purple-700">
                <PlusCircle className="h-4 w-4" />
                Create First Article
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Table view ────────────────────────────────────────────── */}
      {filteredArticles.length > 0 && viewMode === 'table' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-gray-50/80">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600">
                      {allSelected ? <CheckSquare className="h-4 w-4 text-purple-600" /> : <Square className="h-4 w-4" />}
                    </button>
                  </th>
                  <SortableHeader label="Title" field="title" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <SortableHeader label="Modified" field="updated_at" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <SortableHeader label="Views" field="view_count" current={sortField} dir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredArticles.map(article => (
                  <tr
                    key={article.id}
                    className={cn(
                      'group transition-colors cursor-pointer',
                      selectedIds.has(article.id) ? 'bg-purple-50/50' : 'hover:bg-gray-50',
                    )}
                    onClick={() => onEditArticle(article)}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggleSelect(article.id)} className="text-gray-400 hover:text-gray-600">
                        {selectedIds.has(article.id) ? (
                          <CheckSquare className="h-4 w-4 text-purple-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {article.is_featured && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[300px]">{article.title}</p>
                          {article.subtitle && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">{article.subtitle}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{getCategoryName(article.category_id)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={article.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">{getRelativeTime(article.updated_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Eye className="h-3 w-3" />
                        {(article.view_count || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ActionButton icon={Edit} label="Edit" onClick={() => onEditArticle(article)} />
                        <ActionButton icon={Copy} label="Duplicate" onClick={() => handleDuplicate(article.id)} disabled={isProcessing} />
                        <ActionButton icon={Archive} label="Archive" onClick={() => {
                          confirmDialog.open({
                            title: 'Archive Article',
                            description: `Archive "${article.title}"?`,
                            onConfirm: () => handleArchive(article.id),
                          });
                        }} />
                        <ActionButton
                          icon={Trash2}
                          label="Delete"
                          variant="danger"
                          onClick={() => {
                            confirmDialog.open({
                              title: 'Delete Article',
                              description: `Permanently delete "${article.title}"? This cannot be undone.`,
                              onConfirm: () => handleDelete(article.id),
                            });
                          }}
                          disabled={isProcessing}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Card view ─────────────────────────────────────────────── */}
      {filteredArticles.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredArticles.map(article => (
            <ArticleCardItem
              key={article.id}
              article={article}
              categoryName={getCategoryName(article.category_id)}
              selected={selectedIds.has(article.id)}
              onToggleSelect={() => toggleSelect(article.id)}
              onClick={() => onEditArticle(article)}
            />
          ))}
        </div>
      )}

      {/* ── Confirm dialog ────────────────────────────────────────── */}
      {confirmDialog.isOpen && confirmDialog.config && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={confirmDialog.close}
          onConfirm={confirmDialog.confirm}
          title={confirmDialog.config.title}
          description={confirmDialog.config.description}
          variant="danger"
          isLoading={isProcessing}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function StatPill({
  label,
  count,
  active,
  onClick,
  color,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick?: () => void;
  color: 'green' | 'gray' | 'blue' | 'amber';
}) {
  const colorMap = {
    green: 'bg-green-50 text-green-700 border-green-200',
    gray: 'bg-gray-50 text-gray-700 border-gray-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all',
        onClick ? 'cursor-pointer hover:shadow-sm' : 'cursor-default',
        active ? 'ring-2 ring-purple-400 ring-offset-1' : '',
        colorMap[color],
      )}
    >
      <span>{label}</span>
      <span className="font-bold">{count}</span>
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function FilterPill({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 capitalize">
      {label}
      <button onClick={onClear} className="hover:text-purple-900">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function SortableHeader({
  label,
  field,
  current,
  dir,
  onSort,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const isActive = current === field;
  return (
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      <button
        onClick={() => onSort(field)}
        className={cn('flex items-center gap-1 hover:text-gray-700', isActive && 'text-purple-600')}
      >
        {label}
        <ArrowUpDown className={cn('h-3 w-3', isActive ? 'text-purple-600' : 'text-gray-300')} />
      </button>
    </th>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'danger';
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'h-7 w-7 p-0',
        variant === 'danger' && 'text-red-500 hover:text-red-700 hover:bg-red-50',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}

function ArticleCardItem({
  article,
  categoryName,
  selected,
  onToggleSelect,
  onClick,
}: {
  article: Article;
  categoryName: string;
  selected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}) {
  return (
    <Card
      className={cn(
        'group cursor-pointer hover:shadow-md hover:border-purple-200 transition-all relative',
        selected && 'ring-2 ring-purple-400 border-purple-200',
      )}
      onClick={onClick}
    >
      {/* Selection checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onToggleSelect(); }}
        className="absolute top-3 left-3 z-10 text-gray-300 hover:text-gray-600"
      >
        {selected ? <CheckSquare className="h-4 w-4 text-purple-600" /> : <Square className="h-4 w-4" />}
      </button>

      <CardContent className="pt-5 pb-4 px-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 ml-6">
            <StatusBadge status={article.status} />
            {article.is_featured && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
          </div>
          <Badge variant="outline" className="text-[10px] font-normal shrink-0">
            {categoryName}
          </Badge>
        </div>

        <h3 className="font-semibold text-gray-900 line-clamp-2 leading-snug mb-1 group-hover:text-purple-700 transition-colors">
          {article.title}
        </h3>

        {article.excerpt && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {article.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-gray-100">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {getRelativeTime(article.updated_at)}
          </span>
          <div className="flex items-center gap-3">
            {categoryName && (
              <span className="text-purple-600 font-medium">{categoryName}</span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {(article.view_count || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}