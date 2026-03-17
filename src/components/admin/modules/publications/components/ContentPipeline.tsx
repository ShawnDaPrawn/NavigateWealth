/**
 * Content Pipeline (Kanban Board)
 *
 * Visual kanban-style pipeline view showing articles flowing through
 * the editorial workflow: Draft -> In Review -> Scheduled -> Published.
 *
 * Cards are draggable between columns for quick status transitions.
 *
 * @module publications/components/ContentPipeline
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  PenLine,
  Send,
  CalendarDays,
  CheckCircle2,
  Archive,
  GripVertical,
  Eye,
  Star,
  Clock,
  MoreHorizontal,
  PlusCircle,
  Edit,
  Trash2,
  Copy,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import type { Article, ArticleStatus, Category } from '../types';
import { formatDate, getRelativeTime, truncateText } from '../utils';

interface ContentPipelineProps {
  articles: Article[];
  categories: Category[];
  onEditArticle: (article: Article) => void;
  onCreateNew: () => void;
  onStatusChange?: (articleId: string, newStatus: ArticleStatus) => Promise<void>;
}

// ── Column configuration ─────────────────────────────────────────────────

interface PipelineColumn {
  status: ArticleStatus;
  label: string;
  icon: React.ElementType;
  color: string;
  bgLight: string;
  borderColor: string;
}

const COLUMNS: PipelineColumn[] = [
  {
    status: 'draft',
    label: 'Drafts',
    icon: PenLine,
    color: 'text-gray-600',
    bgLight: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  {
    status: 'in_review',
    label: 'In Review',
    icon: Send,
    color: 'text-yellow-600',
    bgLight: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  {
    status: 'scheduled',
    label: 'Scheduled',
    icon: CalendarDays,
    color: 'text-blue-600',
    bgLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    status: 'published',
    label: 'Published',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgLight: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  {
    status: 'archived',
    label: 'Archived',
    icon: Archive,
    color: 'text-red-500',
    bgLight: 'bg-red-50',
    borderColor: 'border-red-200',
  },
];

// ── Component ────────────────────────────────────────────────────────────

export function ContentPipeline({
  articles,
  categories,
  onEditArticle,
  onCreateNew,
  onStatusChange,
}: ContentPipelineProps) {
  const [draggedArticleId, setDraggedArticleId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ArticleStatus | null>(null);

  // Group articles by status
  const grouped = useMemo(() => {
    const map: Record<ArticleStatus, Article[]> = {
      draft: [],
      in_review: [],
      scheduled: [],
      published: [],
      archived: [],
    };

    articles.forEach(a => {
      if (a.status in map) {
        map[a.status].push(a);
      }
    });

    // Sort each column by updated_at desc
    Object.values(map).forEach(list =>
      list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    );

    return map;
  }, [articles]);

  // ── Drag handlers ────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, articleId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', articleId);
    setDraggedArticleId(articleId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: ArticleStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStatus: ArticleStatus) => {
      e.preventDefault();
      setDragOverColumn(null);
      setDraggedArticleId(null);

      const articleId = e.dataTransfer.getData('text/plain');
      if (!articleId || !onStatusChange) return;

      const article = articles.find(a => a.id === articleId);
      if (!article || article.status === targetStatus) return;

      await onStatusChange(articleId, targetStatus);
    },
    [articles, onStatusChange],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedArticleId(null);
    setDragOverColumn(null);
  }, []);

  // ── Get category label ───────────────────────────────────────────────

  const getCategoryName = useCallback(
    (id: string) => categories.find(c => c.id === id)?.name || '',
    [categories],
  );

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Pipeline summary bar */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        {COLUMNS.map((col, i) => {
          const count = grouped[col.status].length;
          const Icon = col.icon;
          return (
            <div className="contents" key={col.status}>
              {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
              <div className="flex items-center gap-1">
                <Icon className={cn('w-3.5 h-3.5', col.color)} />
                <span className="font-medium text-gray-700">{count}</span>
                <span className="hidden sm:inline">{col.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-start min-h-[500px]">
        {COLUMNS.map(col => {
          const colArticles = grouped[col.status];
          const Icon = col.icon;
          const isDragOver = dragOverColumn === col.status;

          return (
            <div
              key={col.status}
              className={cn(
                'rounded-xl border transition-all min-h-[400px] flex flex-col',
                col.borderColor,
                isDragOver ? 'ring-2 ring-purple-400 ring-offset-2 bg-purple-50/40' : 'bg-white',
              )}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              {/* Column header */}
              <div className={cn('px-4 py-3 rounded-t-xl border-b flex items-center gap-2', col.bgLight, col.borderColor)}>
                <Icon className={cn('w-4 h-4', col.color)} />
                <span className="text-sm font-semibold text-gray-800">{col.label}</span>
                <Badge variant="outline" className="ml-auto text-xs px-1.5 py-0">
                  {colArticles.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="flex-1 p-2 space-y-2 overflow-auto max-h-[600px]">
                {colArticles.length === 0 && (
                  <div className="text-center py-10 text-xs text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    No articles
                  </div>
                )}

                {colArticles.map(article => (
                  <PipelineCard
                    key={article.id}
                    article={article}
                    categoryName={getCategoryName(article.category_id)}
                    isDragging={draggedArticleId === article.id}
                    onEdit={() => onEditArticle(article)}
                    onDragStart={(e) => handleDragStart(e, article.id)}
                    onDragEnd={handleDragEnd}
                    draggable={!!onStatusChange}
                  />
                ))}

                {/* Add button for draft column */}
                {col.status === 'draft' && (
                  <button
                    onClick={onCreateNew}
                    className="w-full border-2 border-dashed border-gray-200 rounded-lg py-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50/50 transition-colors"
                  >
                    <PlusCircle className="w-4 h-4" />
                    New Article
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Pipeline Card ────────────────────────────────────────────────────────

interface PipelineCardProps {
  article: Article;
  categoryName: string;
  isDragging: boolean;
  onEdit: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  draggable: boolean;
}

function PipelineCard({
  article,
  categoryName,
  isDragging,
  onEdit,
  onDragStart,
  onDragEnd,
  draggable,
}: PipelineCardProps) {
  return (
    <div
      className={cn(
        'group bg-white border border-gray-150 rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-purple-200 transition-all',
        isDragging && 'opacity-40 scale-95',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onEdit}
    >
      {/* Title */}
      <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
        {article.title}
      </p>

      {/* Excerpt */}
      {article.excerpt && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {truncateText(article.excerpt, 80)}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {categoryName && (
          <span className="text-[11px] font-medium text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
            {categoryName}
          </span>
        )}
        {article.is_featured && (
          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
        )}
        <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {getRelativeTime(article.updated_at)}
        </span>
      </div>

      {/* Views (published only) */}
      {article.status === 'published' && (article.view_count || 0) > 0 && (
        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
          <Eye className="w-3 h-3" />
          {(article.view_count || 0).toLocaleString()} views
        </div>
      )}
    </div>
  );
}