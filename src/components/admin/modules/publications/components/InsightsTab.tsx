import React, { memo, useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { User, ArrowRight, BookOpen, FileText, TrendingUp, PiggyBank, Target, Shield, GraduationCap, Globe, Users, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../../ui/utils';

// ---------------------------------------------------------------------------
// Local types – kept minimal to avoid coupling to the full module type system.
// These describe only what InsightsTab actually renders.
// ---------------------------------------------------------------------------

/** Synthetic "All" category ID used by the parent to aggregate every article */
const ALL_CATEGORY_ID = '__all__';

/** Number of articles displayed per page before pagination kicks in */
const ARTICLES_PER_PAGE = 10;

/** Minimal category shape consumed by InsightsTab */
interface InsightCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  /** Lucide component, string icon name, or undefined */
  icon?: React.ComponentType<{ className?: string }> | string;
}

/** Minimal article shape consumed by InsightsTab */
interface InsightArticle {
  id?: string;
  title: string;
  slug?: string;
  subtitle?: string | null;
  excerpt?: string;
  category_name?: string;
  author_name?: string;
  reading_time_minutes?: number;
  /** Used for chronological sorting — most recent first */
  published_at?: string | null;
  created_at?: string;
}

// Map string icon names to actual Lucide components for resilient rendering
const ICON_RESOLVER: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp, PiggyBank, Target, Shield, FileText, GraduationCap, Globe, Users, LayoutGrid,
};

function resolveIcon(icon: unknown): React.ComponentType<{ className?: string }> | undefined {
  if (typeof icon === 'function') return icon as React.ComponentType<{ className?: string }>;
  if (typeof icon === 'string' && ICON_RESOLVER[icon]) return ICON_RESOLVER[icon];
  return undefined;
}

/**
 * Sort articles by most recent first.
 * Uses published_at when available, falls back to created_at, then title order.
 */
function sortByRecent(a: InsightArticle, b: InsightArticle): number {
  const dateA = a.published_at || a.created_at || '';
  const dateB = b.published_at || b.created_at || '';
  if (dateA && dateB) return new Date(dateB).getTime() - new Date(dateA).getTime();
  if (dateA) return -1;
  if (dateB) return 1;
  return 0;
}

interface InsightsTabProps {
  categories: InsightCategory[];
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  articles: Record<string, InsightArticle[]>;
}

export const InsightsTab = memo(function InsightsTab({ 
  categories, 
  activeCategory, 
  onCategoryChange, 
  articles 
}: InsightsTabProps) {
  const currentCategory = categories.find(cat => cat.id === activeCategory);
  const isAllCategory = activeCategory === ALL_CATEGORY_ID;

  // ── Pagination state (per-category) ──────────────────────────────────────
  const [pageMap, setPageMap] = useState<Record<string, number>>({});
  const currentPage = pageMap[activeCategory] ?? 1;

  const setCurrentPage = (page: number) => {
    setPageMap((prev) => ({ ...prev, [activeCategory]: page }));
  };

  // Reset to page 1 when switching categories
  useEffect(() => {
    if (!(activeCategory in pageMap)) {
      setPageMap((prev) => ({ ...prev, [activeCategory]: 1 }));
    }
  }, [activeCategory]);

  // Sort articles most-recent-first, then paginate
  const sortedArticles = useMemo(() => {
    const raw = articles[activeCategory] || [];
    return [...raw].sort(sortByRecent);
  }, [articles, activeCategory]);

  const totalArticles = sortedArticles.length;
  const totalPages = Math.max(1, Math.ceil(totalArticles / ARTICLES_PER_PAGE));

  // Clamp page in case articles shrink
  const safePage = Math.min(currentPage, totalPages);
  if (safePage !== currentPage && totalArticles > 0) {
    // schedule clamp on next tick to avoid setState-during-render
    setTimeout(() => setCurrentPage(safePage), 0);
  }

  const startIdx = (safePage - 1) * ARTICLES_PER_PAGE;
  const paginatedArticles = sortedArticles.slice(startIdx, startIdx + ARTICLES_PER_PAGE);

  const handleCategoryChange = (id: string) => {
    onCategoryChange(id);
    // Reset to page 1 for newly selected category
    setPageMap((prev) => ({ ...prev, [id]: 1 }));
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of articles grid for better UX
    const grid = document.getElementById('articles-grid');
    if (grid) {
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Sidebar Navigation — horizontal pills on mobile, vertical card on lg+ */}
      <div className="lg:col-span-3 space-y-2">
        {/* Mobile: horizontal scrollable pills */}
        <div className="lg:hidden overflow-x-auto -mx-1 px-1 pb-2 scrollbar-hide">
          <div className="flex gap-2">
            {categories.map((category) => {
              const Icon = resolveIcon(category.icon) || FileText;
              const isActive = activeCategory === category.id;
              const isAll = category.id === ALL_CATEGORY_ID;
              const count = (articles[category.id] || []).length;
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-200 flex-shrink-0",
                    isActive
                      ? "bg-purple-600 text-white shadow-md"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900"
                  )}
                  aria-pressed={isActive}
                  aria-label={`View ${category.name}`}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      isActive ? "text-white" : "text-gray-400"
                    )}
                  />
                  <span>{category.name}</span>
                  {!isAll && count > 0 && (
                    <span
                      className={cn(
                        "ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full",
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop: vertical sidebar card */}
        <div className="hidden lg:block bg-white rounded-xl border border-gray-200 p-4 shadow-sm sticky top-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 px-2">Categories</h3>
          <nav className="space-y-1">
            {categories.map((category) => {
              const Icon = resolveIcon(category.icon) || FileText;
              const isActive = activeCategory === category.id;
              const isAll = category.id === ALL_CATEGORY_ID;
              const count = (articles[category.id] || []).length;
              
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category.id)}
                  className={cn(
                    "w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-purple-50 text-purple-700 shadow-sm ring-1 ring-purple-200"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                  aria-pressed={isActive}
                  aria-label={`View ${category.name}`}
                >
                  <Icon 
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      isActive ? "text-purple-600" : "text-gray-400"
                    )} 
                  />
                  <span className="truncate text-left flex-1">{category.name}</span>
                  {!isAll && count > 0 && (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[11px] font-semibold rounded-full flex-shrink-0",
                        isActive
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-9 space-y-6">
        {/* Category Hero */}
        {currentCategory && (
          <div className="bg-gradient-to-br from-white to-purple-50/50 rounded-xl border border-purple-100 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                {/* Render resolved Icon for category hero */}
                {(() => {
                   const Icon = resolveIcon(currentCategory.icon) || FileText;
                   return <Icon className="h-6 w-6 text-purple-600" />;
                })()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">{currentCategory.name}</h2>
                  <span className="text-sm text-gray-500 font-medium">
                    {totalArticles} {totalArticles === 1 ? 'article' : 'articles'}
                  </span>
                </div>
                <p className="text-gray-600 mt-1 max-w-2xl">{currentCategory.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Articles Grid */}
        {paginatedArticles.length > 0 ? (
          <div className="contents">
            <div id="articles-grid" className="grid md:grid-cols-2 gap-6">
              {paginatedArticles.map((article, index) => (
                <Card 
                  key={article.id || `${article.title}-${startIdx + index}`} 
                  className="group hover:shadow-lg transition-all duration-300 border-gray-200 hover:border-purple-200 flex flex-col"
                >
                  <CardContent className="p-6 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="secondary" className="bg-purple-50 text-purple-700 hover:bg-purple-100">
                        {article.category_name || 'Uncategorized'}
                      </Badge>
                      {article.reading_time_minutes && (
                        <span className="text-xs text-gray-500 font-medium">{article.reading_time_minutes} min read</span>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-purple-700 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    
                    <p className="text-gray-600 text-sm mb-6 line-clamp-2 flex-1">
                      {article.excerpt || article.subtitle}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <User className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{article.author_name || 'Editorial Team'}</span>
                      </div>
                      {article.slug || article.id ? (
                        <Link to={`/resources/article/${article.slug || article.id}`}>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 -mr-2 flex-shrink-0"
                            aria-label={`Read ${article.title}`}
                          >
                            Read More
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 -mr-2 flex-shrink-0"
                          aria-label={`Read ${article.title}`}
                          disabled
                        >
                          Read More
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <PaginationBar
                currentPage={safePage}
                totalPages={totalPages}
                totalItems={totalArticles}
                pageSize={ARTICLES_PER_PAGE}
                onPageChange={handlePageChange}
              />
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <BookOpen className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Articles Yet</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              We're currently curating expert content for this category. Check back soon for detailed guides and analysis.
            </p>
            <Button variant="outline">Browse All Articles</Button>
          </div>
        )}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PaginationBar — clean, accessible pagination controls
// ─────────────────────────────────────────────────────────────────────────────

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function PaginationBar({ currentPage, totalPages, totalItems, pageSize, onPageChange }: PaginationBarProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Build visible page numbers with ellipsis
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis-start');
      }

      // Pages around current
      const rangeStart = Math.max(2, currentPage - 1);
      const rangeEnd = Math.min(totalPages - 1, currentPage + 1);
      for (let i = rangeStart; i <= rangeEnd; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis-end');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-2">
      {/* Item range indicator */}
      <p className="text-sm text-gray-500 order-2 sm:order-1">
        Showing <span className="font-medium text-gray-700">{startItem}</span>–<span className="font-medium text-gray-700">{endItem}</span> of{' '}
        <span className="font-medium text-gray-700">{totalItems}</span> articles
      </p>

      {/* Page controls */}
      <nav className="flex items-center gap-1 order-1 sm:order-2" aria-label="Pagination">
        {/* Previous */}
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-9 w-9 p-0 border-gray-200"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        {pageNumbers.map((page) => {
          if (typeof page === 'string') {
            return (
              <span key={page} className="px-1 text-gray-400 text-sm select-none" aria-hidden="true">
                ...
              </span>
            );
          }

          const isActive = page === currentPage;
          return (
            <Button
              key={page}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPageChange(page)}
              className={cn(
                'h-9 w-9 p-0 text-sm font-medium',
                isActive
                  ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
              aria-label={`Page ${page}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {page}
            </Button>
          );
        })}

        {/* Next */}
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-9 w-9 p-0 border-gray-200"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    </div>
  );
}
