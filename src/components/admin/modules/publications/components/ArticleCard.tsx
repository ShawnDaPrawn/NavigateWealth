/**
 * Publications Feature - ArticleCard Component
 * 
 * Reusable card for displaying article previews with metadata.
 * Supports various display modes and responsive layouts.
 * 
 * @example
 * ```tsx
 * <ArticleCard
 *   article={article}
 *   onClick={() => navigate(`/articles/${article.id}`)}
 *   showStatus={true}
 *   showMetadata={true}
 * />
 * ```
 */

import React from 'react';
import { Calendar, Clock, User, Eye, TrendingUp } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '../utils';
import type { Article, ArticleStatus } from '../types';
import { ImageWithFallback } from '../../../../figma/ImageWithFallback';

interface ArticleCardProps {
  /** The article data to display */
  article: Partial<Article> & { id: string; title: string };
  /** Callback when card is clicked */
  onClick?: () => void;
  /** Whether to show article status badge */
  showStatus?: boolean;
  /** Whether to show feature image */
  showImage?: boolean;
  /** Whether to show metadata (author, date, reading time) */
  showMetadata?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ArticleCard component for displaying article summaries
 */
export function ArticleCard({
  article,
  onClick,
  showStatus = false,
  showImage = true,
  showMetadata = true,
  className
}: ArticleCardProps) {
  const {
    title,
    excerpt,
    feature_image_url,
    category_name,
    author_name,
    reading_time_minutes,
    published_at,
    created_at,
    status,
    is_featured,
    view_count,
    press_category,
  } = article;

  const displayDate = published_at || created_at || new Date().toISOString();

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow ${
        onClick ? 'cursor-pointer' : ''
      } ${className || ''}`}
    >
      {/* Featured Image */}
      {showImage && feature_image_url && (
        <div className="relative h-48 overflow-hidden bg-gray-100">
          <ImageWithFallback
            src={feature_image_url}
            alt={title}
            className="w-full h-full object-cover"
          />
          {is_featured && (
            <div className="absolute top-3 right-3">
              <Badge className="bg-yellow-500 text-white">
                <TrendingUp className="w-3 h-3 mr-1" />
                Featured
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Category & Status */}
        <div className="flex items-center gap-2 mb-3">
          {category_name && (
            <Badge variant="outline" className="text-xs">
              {category_name}
            </Badge>
          )}
          {press_category && (
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
              Press
            </Badge>
          )}
          {showStatus && status && <StatusBadge status={status} />}
        </div>

        {/* Title */}
        <h3 className="text-lg mb-2 text-gray-900 line-clamp-2">
          {title}
        </h3>

        {/* Excerpt */}
        {excerpt && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-3">
            {excerpt}
          </p>
        )}

        {/* Metadata */}
        {showMetadata && (
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            {author_name && (
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{author_name}</span>
              </div>
            )}
            
            {reading_time_minutes && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{reading_time_minutes} min read</span>
              </div>
            )}
            
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(displayDate)}</span>
            </div>

            {view_count !== undefined && view_count > 0 && (
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                <span>{view_count} views</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact article card for lists
 */
export function ArticleCardCompact({
  article,
  onClick,
  showStatus = true,
  className
}: {
  article: Partial<Article> & { id: string; title: string };
  onClick?: () => void;
  showStatus?: boolean;
  className?: string;
}) {
  const {
    title,
    category_name,
    author_name,
    published_at,
    created_at,
    status,
    view_count
  } = article;

  const displayDate = published_at || created_at || new Date().toISOString();

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      } ${className || ''}`}
    >
      <div className="flex-1 min-w-0">
        <h4 className="text-gray-900 truncate mb-1">{title}</h4>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {category_name && <span>{category_name}</span>}
          {author_name && (
            <div className="contents">
              <span>•</span>
              <span>{author_name}</span>
            </div>
          )}
          <span>•</span>
          <span>{formatDate(displayDate)}</span>
          {view_count !== undefined && view_count > 0 && (
            <div className="contents">
              <span>•</span>
              <span>{view_count} views</span>
            </div>
          )}
        </div>
      </div>

      {showStatus && status && (
        <div className="ml-4 flex-shrink-0">
          <StatusBadge status={status} />
        </div>
      )}
    </div>
  );
}