/**
 * RelatedArticles
 *
 * Fetches and displays a grid of related articles from the same category.
 * Renders polished cards with hover effects, image placeholders, and metadata.
 *
 * @module article-detail/RelatedArticles
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Calendar, Clock, ArrowRight, BookOpen } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Card, CardContent } from '../../ui/card';
import { cn } from '../../ui/utils';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  thumbnail_image_url?: string;
  hero_image_url?: string;
  featured_image_url?: string;
  feature_image_url?: string;
  reading_time_minutes?: number;
  published_at?: string;
  category_name?: string;
  category?: { name?: string };
  author_name?: string;
}

interface RelatedArticlesProps {
  /** Current article ID to exclude from results */
  currentArticleId: string;
  /** Category ID to find related articles */
  categoryId?: string;
  /** Maximum articles to show */
  limit?: number;
}

function formatDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function RelatedArticles({
  currentArticleId,
  categoryId,
  limit = 3,
}: RelatedArticlesProps) {
  const [articles, setArticles] = useState<RelatedArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!categoryId) {
      setIsLoading(false);
      return;
    }

    const fetchRelated = async () => {
      try {
        const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications`;
        const response = await fetch(
          `${baseUrl}/articles?status=published&category_id=${categoryId}&limit=${limit + 1}`,
          {
            headers: { Authorization: `Bearer ${publicAnonKey}` },
          }
        );

        if (!response.ok) return;

        const data = await response.json();
        const all = (data.data || []) as RelatedArticle[];
        const filtered = all
          .filter((a) => a.id !== currentArticleId)
          .slice(0, limit);
        setArticles(filtered);
      } catch (err) {
        console.error('RelatedArticles fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRelated();
  }, [currentArticleId, categoryId, limit]);

  if (isLoading) {
    return (
      <section className="mt-16 pt-12 border-t border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Continue Reading</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-48 bg-gray-200 rounded-t-xl" />
              <div className="p-5 bg-white rounded-b-xl border border-t-0 border-gray-200">
                <div className="h-4 bg-gray-200 rounded mb-3 w-3/4" />
                <div className="h-3 bg-gray-200 rounded mb-2 w-full" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (articles.length === 0) return null;

  return (
    <section className="mt-16 pt-12 border-t border-gray-200">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Continue Reading</h2>
        <Link
          to="/resources"
          className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
        >
          View all articles
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {articles.map((article) => {
          const image =
            article.thumbnail_image_url ||
            article.hero_image_url ||
            article.featured_image_url ||
            article.feature_image_url ||
            '';
          const catName =
            article.category_name || article.category?.name || '';

          return (
            <Link
              key={article.id}
              to={`/resources/article/${article.slug}`}
              className="group block"
            >
              <Card className="overflow-hidden border-gray-200 h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                {/* Image */}
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-50">
                  {image ? (
                    <img
                      src={image}
                      alt={article.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="h-12 w-12 text-purple-200" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-purple-900/0 group-hover:bg-purple-900/10 transition-colors duration-300" />
                </div>

                <CardContent className="p-5">
                  {/* Category */}
                  {catName && (
                    <Badge
                      variant="outline"
                      className="text-xs mb-3 text-purple-600 border-purple-200"
                    >
                      {catName}
                    </Badge>
                  )}

                  {/* Title */}
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-700 transition-colors">
                    {article.title}
                  </h3>

                  {/* Excerpt */}
                  {article.excerpt && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                      {article.excerpt}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    {article.published_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(article.published_at)}</span>
                      </div>
                    )}
                    {article.reading_time_minutes && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{article.reading_time_minutes} min</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
