/**
 * FeaturedInsights — Homepage Featured Articles Section
 *
 * Fetches published articles marked as `is_featured: true` from the publications
 * API and renders them on the public homepage. Silently renders nothing when
 * there are no featured articles, so the homepage never shows an empty state.
 *
 * Layout:
 *   - 1 article → full-width hero card (landscape, image left, content right)
 *   - 2–4 articles → hero card + secondary article grid (up to 3 cards)
 *
 * URL pattern: /resources/article/:slug
 *
 * Guidelines:
 *   §3.2 — frontend never accesses Supabase directly; uses server API
 *   §7   — no business logic in UI; pure presentation
 *   §8.3 — white section background, consistent stat card/card patterns
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Calendar, Clock, ArrowRight, Star } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeaturedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  author_name?: string;
  category_name?: string;
  published_at?: string;
  reading_time_minutes?: number;
  hero_image_url?: string;
  thumbnail_image_url?: string;
  featured_image_url?: string;
  view_count?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function resolveImage(article: FeaturedArticle): string {
  return (
    article.hero_image_url ||
    article.thumbnail_image_url ||
    article.featured_image_url ||
    ''
  );
}

function articlePath(slug: string): string {
  return `/resources/article/${slug}`;
}

/**
 * Sorts up to 4 featured articles so the one with the highest view_count is
 * first (hero position). Ties are broken by published_at descending (most
 * recent first), which is the most contextually logical ordering for a wealth
 * management platform.
 */
function sortFeaturedArticles(articles: FeaturedArticle[]): FeaturedArticle[] {
  return [...articles].sort((a, b) => {
    const viewDiff = (b.view_count ?? 0) - (a.view_count ?? 0);
    if (viewDiff !== 0) return viewDiff;
    // Tiebreaker: most recently published first
    const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
    const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
    return bTime - aTime;
  });
}

// ── Loading skeletons ─────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div className="grid lg:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
      <Skeleton className="aspect-[4/3] lg:aspect-auto lg:h-full min-h-[260px] w-full rounded-none" />
      <div className="p-8 lg:p-10 flex flex-col justify-center gap-4">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="h-10 w-36 mt-2" />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-white flex flex-col">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <Skeleton className="h-4 w-20 rounded-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

// ── Hero article card ─────────────────────────────────────────────────────────

function HeroArticleCard({ article }: { article: FeaturedArticle }) {
  const image = resolveImage(article);

  return (
    <Link
      to={articlePath(article.slug)}
      className="group grid lg:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg bg-white transition-shadow duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] lg:aspect-auto overflow-hidden bg-gray-100">
        {image ? (
          <img
            src={image}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <Star className="h-16 w-16 text-primary/30" />
          </div>
        )}
        {/* Featured ribbon */}
        <div className="absolute top-4 left-4 flex gap-2">
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-0 text-xs font-medium shadow-sm">
            <Star className="h-3 w-3 mr-1 fill-white" />
            Featured
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 lg:p-10 flex flex-col justify-center gap-4">
        {article.category_name && (
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
            {article.category_name}
          </span>
        )}

        <h3 className="text-gray-900 text-xl lg:text-2xl font-bold leading-tight group-hover:text-primary transition-colors duration-200 line-clamp-3">
          {article.title}
        </h3>

        {article.excerpt && (
          <p className="text-gray-600 leading-relaxed line-clamp-3 text-[14px]">
            {article.excerpt}
          </p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
          {article.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(article.published_at)}
            </span>
          )}
          {article.reading_time_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {article.reading_time_minutes} min read
            </span>
          )}
          {article.author_name && (
            <span className="text-gray-400">{article.author_name}</span>
          )}
        </div>

        <div className="mt-2">
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 group/btn pointer-events-none"
            tabIndex={-1}
          >
            Read Article
            <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-0.5 transition-transform duration-200" />
          </Button>
        </div>
      </div>
    </Link>
  );
}

// ── Secondary article card ────────────────────────────────────────────────────

function ArticleCard({ article }: { article: FeaturedArticle }) {
  const image = resolveImage(article);

  return (
    <Link
      to={articlePath(article.slug)}
      className="group rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg bg-white transition-shadow duration-300 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] overflow-hidden bg-gray-100">
        {image ? (
          <img
            src={image}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <Star className="h-8 w-8 text-primary/30" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-2.5 flex-1">
        {article.category_name && (
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            {article.category_name}
          </span>
        )}

        <h4 className="text-gray-900 font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200 text-[15px]">
          {article.title}
        </h4>

        {article.excerpt && (
          <p className="text-gray-500 text-[13px] leading-relaxed line-clamp-2 flex-1">
            {article.excerpt}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-auto pt-2 border-t border-gray-50">
          {article.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(article.published_at)}
            </span>
          )}
          {article.reading_time_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {article.reading_time_minutes} min
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function FeaturedInsights() {
  const [articles, setArticles] = useState<FeaturedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const url = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/articles?status=published&is_featured=true&limit=4`;

    fetch(url, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          const raw: FeaturedArticle[] = Array.isArray(json?.data) ? json.data : [];
          setArticles(sortFeaturedArticles(raw.slice(0, 4)));
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Silently hide if no articles and not loading (nothing to show)
  if (!loading && (error || articles.length === 0)) return null;

  const [hero, ...secondary] = articles;

  return (
    <section className="py-20 bg-gray-100">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Section header */}
        <div className="flex items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="text-black mb-2 font-bold text-[20px]">
              Featured Insights
            </h2>
            <p className="text-gray-600 max-w-xl text-[15px]">
              Expert perspectives on wealth management, tax planning, and financial strategy from our advisers.
            </p>
          </div>
          <Link
            to="/resources?section=insights"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors duration-200 shrink-0 pb-1"
          >
            View All Insights
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-6">
            <HeroSkeleton />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && articles.length > 0 && (
          <div className="space-y-6">
            {/* Hero article */}
            <HeroArticleCard article={hero} />

            {/* Secondary articles grid */}
            {secondary.length > 0 && (
              <div className={`grid gap-6 ${
                secondary.length === 1
                  ? 'sm:grid-cols-1 max-w-sm'
                  : secondary.length === 2
                  ? 'sm:grid-cols-2 lg:max-w-2xl'
                  : 'sm:grid-cols-2 lg:grid-cols-3'
              }`}>
                {secondary.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mobile "View All" */}
        <div className="sm:hidden mt-8 text-center">
          <Button variant="outline" asChild>
            <Link to="/resources?section=insights">
              View All Insights
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}