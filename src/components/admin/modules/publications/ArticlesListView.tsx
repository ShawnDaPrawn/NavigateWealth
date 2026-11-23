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

import { useState, useMemo, useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { ArticleReshareDialog } from './components/ArticleReshareDialog';

import { Badge } from '../../../ui/badge';
import { Card, CardContent } from '../../../ui/card';
import {
  Mail,
  MoreHorizontal,
  Eye,
  Copy,
  Archive,
  Trash2,
  Clock,
  Star,
  X,
  ArrowUpDown,
  CheckSquare,
  Square,
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { DsButton, DsSegmented, DsState } from '../../layout/page';

// Hooks & components
import {
  useArticles,
  useCategories,
  useArticleActions,
  useArchiveArticles,
  useDeleteArticles,
} from './hooks';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';
import { StatusBadge } from './components/StatusBadge';
import { ConfirmDialog, useConfirmDialog } from './components/ConfirmDialog';
import { getRelativeTime } from './utils';
import type { Article } from './types';
import { toast } from 'sonner';

interface ArticlesListViewProps {
  onCreateNew: () => void;
  onEditArticle: (article: Article) => void;
}

type ViewMode = 'table' | 'cards';
type SortField = 'updated_at' | 'created_at' | 'title' | 'view_count' | 'published_at';
type SortDir = 'asc' | 'desc';

export function ArticlesListView({ onCreateNew, onEditArticle }: ArticlesListViewProps) {
  const [resendArticle, setResendArticle] = useState<Article | null>(null);
  // ── Data ─────────────────────────────────────────────────────────────
  const { articles, isLoading, error, refetch } = useArticles();
  const { categories } = useCategories({ activeOnly: true });

  // ── View state ───────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Bulk selection ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Actions ──────────────────────────────────────────────────────────
  const { handleDuplicate, isProcessing } = useArticleActions({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err),
  });
  // Deleted and archived rows change in the list immediately; see the hooks.
  const { mutate: deleteArticles, isPending: isDeleting } = useDeleteArticles();
  const { mutate: archiveArticles, isPending: isArchiving } = useArchiveArticles();
  const isBusy = isProcessing || isDeleting || isArchiving;

  const confirmDialog = useConfirmDialog();

  // ── Helpers ──────────────────────────────────────────────────────────
  const getCategoryName = useCallback(
    (id: string) => categories.find((c) => c.id === id)?.name || 'Unknown',
    [categories],
  );

  // ── Filter + sort ────────────────────────────────────────────────────
  const filteredArticles = useMemo(() => {
    let list = articles;

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.excerpt?.toLowerCase().includes(q) ||
          a.subtitle?.toLowerCase().includes(q),
      );
    }

    // Filters
    if (selectedStatus) list = list.filter((a) => a.status === selectedStatus);
    if (selectedCategory) list = list.filter((a) => a.category_id === selectedCategory);
    if (featuredOnly) list = list.filter((a) => a.is_featured);

    // Sort. Precompute each article's comparable key once (a single pass)
    // rather than re-parsing dates / lowercasing inside the comparator, which
    // would repeat the work O(n log n) times.
    const sortKey = (a: (typeof list)[number]): string | number => {
      switch (sortField) {
        case 'title':
          return a.title.toLowerCase();
        case 'view_count':
          return a.view_count || 0;
        case 'published_at':
          return a.published_at ? new Date(a.published_at).getTime() : 0;
        case 'created_at':
          return new Date(a.created_at).getTime();
        default:
          return new Date(a.updated_at).getTime();
      }
    };

    const keyed = list.map((a) => ({ article: a, key: sortKey(a) }));
    keyed.sort((a, b) => {
      // Featured articles always sort to the top
      if (a.article.is_featured && !b.article.is_featured) return -1;
      if (!a.article.is_featured && b.article.is_featured) return 1;

      if (a.key < b.key) return sortDir === 'asc' ? -1 : 1;
      if (a.key > b.key) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return keyed.map((entry) => entry.article);
  }, [articles, searchQuery, selectedStatus, selectedCategory, sortField, sortDir, featuredOnly]);

  // ── Active filter count ──────────────────────────────────────────────
  const activeFilterCount = [selectedStatus, selectedCategory].filter(Boolean).length;

  // ── Bulk actions ─────────────────────────────────────────────────────
  const allSelected = filteredArticles.length > 0 && selectedIds.size === filteredArticles.length;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredArticles.map((a) => a.id)));
    }
  }, [allSelected, filteredArticles]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkArchive = useCallback(() => {
    const selected = articles.filter((a) => selectedIds.has(a.id));
    const toArchive = selected.filter((a) => a.status !== 'archived');

    if (toArchive.length === 0) {
      toast.info('The selected articles are already archived.');
      return;
    }

    // Archiving a published article takes it off the public site, so say so.
    const liveCount = toArchive.filter((a) => a.status === 'published').length;
    const liveNote =
      liveCount > 0
        ? ` ${liveCount} of them are published and will be taken off the live site.`
        : '';
    confirmDialog.open({
      title: 'Archive Selected',
      description: `Are you sure you want to archive ${toArchive.length} article(s)?${liveNote}`,
      onConfirm: () => {
        setSelectedIds(new Set());
        archiveArticles({ ids: toArchive.map((a) => a.id), mode: 'bulk' });
      },
    });
  }, [articles, selectedIds, archiveArticles, confirmDialog]);

  const handleBulkDelete = useCallback(() => {
    // Published articles are never bulk deleted (the server refuses them too),
    // so they are left out up front and the dialog says so.
    const selected = articles.filter((a) => selectedIds.has(a.id));
    const deletable = selected.filter((a) => a.status !== 'published').map((a) => a.id);
    const publishedCount = selected.length - deletable.length;

    if (deletable.length === 0) {
      toast.info(
        'Published articles cannot be bulk deleted. Delete them one at a time, or unpublish them first.',
      );
      return;
    }

    const keptNote =
      publishedCount > 0
        ? ` ${publishedCount} published article(s) in your selection will be kept.`
        : '';
    confirmDialog.open({
      title: 'Delete Selected',
      description: `Are you sure you want to permanently delete ${deletable.length} article(s)? This cannot be undone.${keptNote}`,
      onConfirm: () => {
        setSelectedIds(new Set());
        deleteArticles({ ids: deletable, mode: 'bulk' });
      },
    });
  }, [articles, selectedIds, deleteArticles, confirmDialog]);

  // ── Sort toggle ──────────────────────────────────────────────────────
  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('desc');
      }
    },
    [sortField],
  );

  // ── Stats ────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      published: articles.filter((a) => a.status === 'published').length,
      draft: articles.filter((a) => a.status === 'draft').length,
      scheduled: articles.filter((a) => a.status === 'scheduled').length,
      featured: articles.filter((a) => a.is_featured).length,
    }),
    [articles],
  );

  // ── Loading / error ──────────────────────────────────────────────────
  if (isLoading) return <LoadingState message="Loading articles..." />;
  if (error)
    return <ErrorState title="Unable to load articles" message={error} onRetry={refetch} />;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Toolbar (PU-Articles): search, status chips, filters, sort, layout ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[280px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles…"
            aria-label="Search articles"
            className="ds-input w-full"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nw-text-3 hover:text-nw-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {(
          [
            ['published', 'Published', stats.published],
            ['draft', 'Drafts', stats.draft],
            ['scheduled', 'Scheduled', stats.scheduled],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            aria-pressed={selectedStatus === value}
            className={cn('ds-chip', selectedStatus === value && 'on')}
            onClick={() => setSelectedStatus((s) => (s === value ? '' : value))}
          >
            {label} · {count}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={featuredOnly}
          className={cn('ds-chip', featuredOnly && 'on')}
          onClick={() => setFeaturedOnly((f) => !f)}
        >
          Featured · {stats.featured}
        </button>
        <span className="grow" />
        <DsButton size="sm" aria-expanded={showFilters} onClick={() => setShowFilters((f) => !f)}>
          Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
        </DsButton>
        <DsButton size="sm" variant="ghost" onClick={() => toggleSort(sortField)}>
          Sort:{' '}
          {sortField === 'updated_at'
            ? 'Modified'
            : sortField === 'title'
              ? 'Title'
              : sortField === 'view_count'
                ? 'Views'
                : 'Date'}{' '}
          {sortDir === 'asc' ? '↑' : '↓'}
        </DsButton>
        <DsSegmented<ViewMode>
          label="Layout"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'table', label: 'Table' },
            { value: 'cards', label: 'Cards' },
          ]}
        />
      </div>

      {/* ── Filter panel ──────────────────────────────────────── */}
      {showFilters && (
        <div className="ds-card ds-card-b">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FilterSelect
              label="Status"
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'published', label: 'Published' },
                { value: 'draft', label: 'Draft' },
                { value: 'in_review', label: 'In review' },
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
            <FilterSelect
              label="Category"
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={[
                { value: '', label: 'All categories' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Active:</span>
              {selectedStatus && (
                <FilterPill
                  label={selectedStatus.replace('_', ' ')}
                  onClear={() => setSelectedStatus('')}
                />
              )}
              {selectedCategory && (
                <FilterPill
                  label={getCategoryName(selectedCategory)}
                  onClear={() => setSelectedCategory('')}
                />
              )}
              <button
                onClick={() => {
                  setSelectedStatus('');
                  setSelectedCategory('');
                }}
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
        <div className="ds-notice dark" role="status">
          <b>{selectedIds.size} selected</b>
          <span className="grow" />
          <DsButton size="sm" onClick={handleBulkArchive} disabled={isBusy}>
            Archive
          </DsButton>
          <DsButton size="sm" variant="danger" onClick={handleBulkDelete} disabled={isBusy}>
            Delete
          </DsButton>
          <DsButton
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10"
            onClick={() => setSelectedIds(new Set())}
          >
            Deselect all
          </DsButton>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────── */}
      {filteredArticles.length === 0 && (
        <section className="ds-card">
          <DsState
            title={articles.length === 0 ? 'No articles yet' : 'No articles match your filters'}
            action={
              articles.length === 0 ? (
                <DsButton variant="primary" onClick={onCreateNew}>
                  New article
                </DsButton>
              ) : (
                <DsButton
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedStatus('');
                    setSelectedCategory('');
                    setFeaturedOnly(false);
                  }}
                >
                  Clear filters
                </DsButton>
              )
            }
          />
        </section>
      )}

      {/* ── Table view ────────────────────────────────────────────── */}
      {filteredArticles.length > 0 && viewMode === 'table' && (
        <section className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead className="border-b border-nw-line bg-[#fbfaf7]">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      aria-label={allSelected ? 'Deselect all' : 'Select all'}
                      className="text-nw-text-3 hover:text-nw-ink"
                    >
                      {allSelected ? (
                        <CheckSquare className="h-4 w-4 text-purple-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <SortableHeader
                    label="Title"
                    field="title"
                    current={sortField}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="hidden px-4 py-2.5 text-left text-[12px] font-medium text-nw-text-3 sm:table-cell">
                    Category
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-[12px] font-medium text-nw-text-3 sm:table-cell">
                    Status
                  </th>
                  <SortableHeader
                    className="hidden sm:table-cell"
                    label="Modified"
                    field="updated_at"
                    current={sortField}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableHeader
                    className="hidden sm:table-cell"
                    label="Views"
                    field="view_count"
                    current={sortField}
                    dir={sortDir}
                    onSort={toggleSort}
                  />
                  <th className="px-4 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nw-line">
                {filteredArticles.map((article) => (
                  <tr
                    key={article.id}
                    className={cn(
                      'group transition-colors cursor-pointer',
                      selectedIds.has(article.id) ? 'bg-nw-violet-50/60' : 'hover:bg-[#fbfaf7]',
                    )}
                    onClick={() => onEditArticle(article)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => toggleSelect(article.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {selectedIds.has(article.id) ? (
                          <CheckSquare className="h-4 w-4 text-purple-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-3 sm:px-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium text-nw-ink">
                            <span className="line-clamp-2 sm:line-clamp-1 sm:max-w-[360px]">
                              {article.title}
                            </span>
                            {article.is_featured && <span className="ds-pill brand">Featured</span>}
                          </p>
                          {article.subtitle && (
                            <p className="hidden max-w-[300px] truncate text-xs text-muted-foreground sm:block">
                              {article.subtitle}
                            </p>
                          )}
                          {/* On a phone status, category and date sit under the title. */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 sm:hidden">
                            <StatusBadge status={article.status} />
                            <span>{getCategoryName(article.category_id)}</span>
                            <span>· {getRelativeTime(article.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="text-nw-text-2">{getCategoryName(article.category_id)}</span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <StatusBadge status={article.status} />
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="text-nw-text-2" title={getRelativeTime(article.updated_at)}>
                        {formatShortDate(article.updated_at)}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <span className="tabular-nums text-nw-text-2">
                        {article.view_count ? article.view_count.toLocaleString() : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <DsButton size="sm" onClick={() => onEditArticle(article)}>
                          Edit
                        </DsButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <DsButton
                              size="sm"
                              variant="ghost"
                              aria-label={`More actions for ${article.title}`}
                              disabled={isBusy}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </DsButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {article.status === 'published' && (
                              <DropdownMenuItem onSelect={() => setResendArticle(article)}>
                                <Mail className="h-4 w-4" aria-hidden="true" />
                                Resend by email…
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={() => handleDuplicate(article.id)}>
                              <Copy className="h-4 w-4" aria-hidden="true" />
                              Duplicate
                            </DropdownMenuItem>
                            {article.status !== 'archived' && (
                              <DropdownMenuItem
                                onSelect={() => {
                                  confirmDialog.open({
                                    title: 'Archive article',
                                    description:
                                      article.status === 'published'
                                        ? `Archive "${article.title}"? It is published and will be taken off the live site.`
                                        : `Archive "${article.title}"?`,
                                    onConfirm: () =>
                                      archiveArticles({ ids: [article.id], mode: 'single' }),
                                  });
                                }}
                              >
                                <Archive className="h-4 w-4" aria-hidden="true" />
                                Archive…
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-700"
                              onSelect={() => {
                                confirmDialog.open({
                                  title: 'Delete article',
                                  description: `Permanently delete "${article.title}"? This cannot be undone.`,
                                  onConfirm: () =>
                                    deleteArticles({ ids: [article.id], mode: 'single' }),
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              Delete…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-nw-line px-4 py-2.5">
            <span className="ds-meta">
              {filteredArticles.length === articles.length
                ? `${articles.length} articles`
                : `${filteredArticles.length} of ${articles.length} articles`}
            </span>
          </div>
        </section>
      )}

      {/* ── Card view ─────────────────────────────────────────────── */}
      {filteredArticles.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredArticles.map((article) => (
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

      {resendArticle && (
        <ArticleReshareDialog
          article={resendArticle}
          open={Boolean(resendArticle)}
          onOpenChange={(open) => {
            if (!open) setResendArticle(null);
          }}
        />
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

/** "6 Nov" (this year) or "6 Nov 2025" — the board's Modified column. */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
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
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
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
  onSort,
  className,
}: {
  className?: string;
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const isActive = current === field;
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
        className,
      )}
    >
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
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        className="absolute top-3 left-3 z-10 text-gray-300 hover:text-gray-600"
      >
        {selected ? (
          <CheckSquare className="h-4 w-4 text-purple-600" />
        ) : (
          <Square className="h-4 w-4" />
        )}
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
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{article.excerpt}</p>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-gray-100">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {getRelativeTime(article.updated_at)}
          </span>
          <div className="flex items-center gap-3">
            {categoryName && <span className="text-purple-600 font-medium">{categoryName}</span>}
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
