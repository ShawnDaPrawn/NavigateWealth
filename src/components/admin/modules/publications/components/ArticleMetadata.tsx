/**
 * Publications Feature - ArticleMetadata Component
 * 
 * Display article metadata (author, date, reading time, views).
 */

import React from 'react';
import { Calendar, Clock, User, Eye } from 'lucide-react';
import { formatDate, formatDateTime, getRelativeTime } from '../utils';

interface ArticleMetadataProps {
  author?: string;
  date: string;
  readingTime?: number;
  viewCount?: number;
  showRelativeTime?: boolean;
  className?: string;
}

export function ArticleMetadata({
  author,
  date,
  readingTime,
  viewCount,
  showRelativeTime = false,
  className
}: ArticleMetadataProps) {
  const formattedDate = showRelativeTime ? getRelativeTime(date) : formatDate(date);

  return (
    <div className={`flex flex-wrap items-center gap-4 text-sm text-gray-600 ${className || ''}`}>
      {author && (
        <div className="flex items-center gap-1.5">
          <User className="w-4 h-4" />
          <span>{author}</span>
        </div>
      )}
      
      <div className="flex items-center gap-1.5">
        <Calendar className="w-4 h-4" />
        <span>{formattedDate}</span>
      </div>
      
      {readingTime && (
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          <span>{readingTime} min read</span>
        </div>
      )}
      
      {viewCount !== undefined && viewCount > 0 && (
        <div className="flex items-center gap-1.5">
          <Eye className="w-4 h-4" />
          <span>{viewCount.toLocaleString()} views</span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact metadata (single line)
 */
export function ArticleMetadataCompact({
  author,
  date,
  readingTime,
  className
}: {
  author?: string;
  date: string;
  readingTime?: number;
  className?: string;
}) {
  const parts = [];
  
  if (author) parts.push(author);
  parts.push(formatDate(date));
  if (readingTime) parts.push(`${readingTime} min read`);

  return (
    <div className={`text-sm text-gray-600 ${className || ''}`}>
      {parts.join(' • ')}
    </div>
  );
}

/**
 * Detailed metadata with timestamps
 */
export function ArticleMetadataDetailed({
  author,
  createdAt,
  updatedAt,
  publishedAt,
  lastEditedBy,
  className
}: {
  author?: string;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
  lastEditedBy?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-2 text-sm ${className || ''}`}>
      {author && (
        <div className="flex items-center gap-2 text-gray-700">
          <User className="w-4 h-4" />
          <span>Author: <strong>{author}</strong></span>
        </div>
      )}
      
      <div className="text-gray-600 space-y-1">
        <div>Created: {formatDateTime(createdAt)}</div>
        
        {updatedAt && updatedAt !== createdAt && (
          <div>
            Updated: {formatDateTime(updatedAt)}
            {lastEditedBy && <span> by {lastEditedBy}</span>}
          </div>
        )}
        
        {publishedAt && (
          <div>Published: {formatDateTime(publishedAt)}</div>
        )}
      </div>
    </div>
  );
}
