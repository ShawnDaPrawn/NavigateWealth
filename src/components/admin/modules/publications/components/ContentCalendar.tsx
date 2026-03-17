/**
 * ContentCalendar — Visual Content Calendar (Phase 4)
 *
 * Monthly calendar view showing articles by their relevant dates:
 * published, scheduled, or created. Allows visual content planning
 * and quick access to article editing.
 *
 * @module publications/components/ContentCalendar
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  FileText,
  Clock,
  Eye,
  Star,
  Edit2,
  PlusCircle,
} from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { cn } from '../../../../ui/utils';
import type { Article, Category, ArticleStatus } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContentCalendarProps {
  articles: Article[];
  categories: Category[];
  onEditArticle: (article: Article) => void;
  onCreateNew: () => void;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  articles: Article[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getArticleDate(article: Article): string | null {
  if (article.status === 'published' && article.published_at) return article.published_at;
  if (article.status === 'scheduled' && article.scheduled_for) return article.scheduled_for;
  return article.created_at;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getMonthDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date();

  const days: CalendarDay[] = [];

  // Fill in days from previous month
  const startDow = firstDay.getDay(); // 0=Sun
  for (let i = startDow - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      articles: [],
    });
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      articles: [],
    });
  }

  // Fill remaining cells to complete grid (6 rows of 7)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(year, month + 1, i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      articles: [],
    });
  }

  return days;
}

const STATUS_DOT_COLORS: Record<ArticleStatus, string> = {
  draft: 'bg-gray-400',
  in_review: 'bg-amber-500',
  scheduled: 'bg-blue-500',
  published: 'bg-green-500',
  archived: 'bg-red-400',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContentCalendar({
  articles,
  categories,
  onEditArticle,
  onCreateNew,
}: ContentCalendarProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  // Build calendar days with articles assigned
  const calendarDays = useMemo(() => {
    const days = getMonthDays(currentYear, currentMonth);

    // Assign articles to days
    for (const article of articles) {
      const dateStr = getArticleDate(article);
      if (!dateStr) continue;
      const date = new Date(dateStr);

      const day = days.find((d) => isSameDay(d.date, date));
      if (day) {
        day.articles.push(article);
      }
    }

    return days;
  }, [articles, currentYear, currentMonth]);

  // Navigation
  const goToPreviousMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDay(null);
  }, [currentMonth]);

  const goToNextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDay(null);
  }, [currentMonth]);

  const goToToday = useCallback(() => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(null);
  }, []);

  // Stats for the month
  const monthStats = useMemo(() => {
    const monthArticles = calendarDays
      .filter((d) => d.isCurrentMonth)
      .flatMap((d) => d.articles);

    return {
      total: monthArticles.length,
      published: monthArticles.filter((a) => a.status === 'published').length,
      scheduled: monthArticles.filter((a) => a.status === 'scheduled').length,
      drafts: monthArticles.filter((a) => a.status === 'draft').length,
    };
  }, [calendarDays]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <CalendarIcon className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Content Calendar</h2>
            <p className="text-xs text-gray-500">
              {monthStats.total} articles this month
              {monthStats.scheduled > 0 && ` · ${monthStats.scheduled} scheduled`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={goToPreviousMonth} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-gray-900 min-w-[160px] text-center">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <Button variant="ghost" size="sm" onClick={goToNextMonth} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={onCreateNew}
            className="gap-1.5 bg-purple-600 hover:bg-purple-700"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            New Article
          </Button>
        </div>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Published', count: monthStats.published, color: 'bg-green-500' },
          { label: 'Scheduled', count: monthStats.scheduled, color: 'bg-blue-500' },
          { label: 'Drafts', count: monthStats.drafts, color: 'bg-gray-400' },
          { label: 'Total', count: monthStats.total, color: 'bg-purple-500' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl"
          >
            <div className={cn('w-2 h-2 rounded-full', stat.color)} />
            <div>
              <p className="text-lg font-bold text-gray-900">{stat.count}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(day.articles.length > 0 ? day : null)}
              className={cn(
                'min-h-[100px] p-1.5 border-b border-r border-gray-100 text-left transition-colors',
                !day.isCurrentMonth && 'bg-gray-50/50',
                day.isToday && 'bg-purple-50/50',
                selectedDay && isSameDay(selectedDay.date, day.date) && 'ring-2 ring-purple-500 ring-inset',
                day.articles.length > 0 && 'hover:bg-gray-50 cursor-pointer'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-xs font-medium',
                    day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400',
                    day.isToday &&
                      'bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                  )}
                >
                  {day.date.getDate()}
                </span>
                {day.articles.length > 2 && (
                  <span className="text-[10px] text-gray-400 font-medium">
                    +{day.articles.length - 2}
                  </span>
                )}
              </div>

              {/* Article pills (show max 2) */}
              <div className="space-y-0.5">
                {day.articles.slice(0, 2).map((article) => (
                  <div
                    key={article.id}
                    className={cn(
                      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] truncate',
                      article.status === 'published' && 'bg-green-100 text-green-800',
                      article.status === 'scheduled' && 'bg-blue-100 text-blue-800',
                      article.status === 'draft' && 'bg-gray-100 text-gray-700',
                      article.status === 'in_review' && 'bg-amber-100 text-amber-800',
                      article.status === 'archived' && 'bg-red-100 text-red-700'
                    )}
                  >
                    <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_DOT_COLORS[article.status])} />
                    <span className="truncate">{article.title}</span>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected day detail panel */}
      {selectedDay && selectedDay.articles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {formatDate(selectedDay.date)} — {selectedDay.articles.length} article
              {selectedDay.articles.length !== 1 ? 's' : ''}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)} className="text-xs">
              Close
            </Button>
          </div>

          <div className="space-y-3">
            {selectedDay.articles.map((article) => {
              const category = article.category_id ? categoryMap.get(article.category_id) : null;
              return (
                <div
                  key={article.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 transition-colors group"
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      article.status === 'published' ? 'bg-green-100' : 'bg-gray-100'
                    )}
                  >
                    <FileText className={cn(
                      'h-4 w-4',
                      article.status === 'published' ? 'text-green-600' : 'text-gray-500'
                    )} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{article.title}</h4>
                      {article.is_featured && (
                        <Star className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1 mb-2">{article.excerpt}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn('text-[10px] px-1.5 py-0', STATUS_COLORS[article.status])}>
                        {STATUS_LABELS[article.status]}
                      </Badge>
                      {category && (
                        <span className="text-[10px] text-gray-400">{category.name}</span>
                      )}
                      {article.view_count !== undefined && article.view_count > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                          <Eye className="h-3 w-3" />
                          {article.view_count}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditArticle(article);
                    }}
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center">
        {(
          [
            { status: 'published' as const, label: 'Published' },
            { status: 'scheduled' as const, label: 'Scheduled' },
            { status: 'in_review' as const, label: 'In Review' },
            { status: 'draft' as const, label: 'Draft' },
          ] as const
        ).map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className={cn('w-2 h-2 rounded-full', STATUS_DOT_COLORS[status])} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
