import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * SocialMediaSkeleton
 *
 * Mirrors the SocialMediaModule layout:
 * - Header (title + subtitle)
 * - 3-column tab bar (Publications, Social Media, Partners)
 * - Content area with cards
 */

function ContentCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-white p-5 space-y-3">
      <Skeleton className="h-40 w-full rounded-md" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function SocialMediaSkeleton() {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading social media">
      <span className="sr-only">Loading social media module, please wait…</span>
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-72 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="grid w-full max-w-2xl grid-cols-3 h-10 rounded-md bg-muted p-1">
          <Skeleton className="h-full rounded-sm" />
          <Skeleton className="h-full rounded-sm bg-transparent" />
          <Skeleton className="h-full rounded-sm bg-transparent" />
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ContentCardSkeleton />
          <ContentCardSkeleton />
          <ContentCardSkeleton />
          <ContentCardSkeleton />
          <ContentCardSkeleton />
          <ContentCardSkeleton />
        </div>
      </div>
    </div>
  );
}