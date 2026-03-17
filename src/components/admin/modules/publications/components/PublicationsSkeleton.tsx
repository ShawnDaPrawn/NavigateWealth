import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * PublicationsSkeleton
 *
 * Mirrors the PublicationsModule layout:
 * - Sticky header (title + Refresh + New Article buttons)
 * - 6-tab bar (Analytics, Articles, Pipeline, Categories, Types, Settings)
 * - Analytics content area with KPI cards and charts
 */

function KPICardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-white p-5 space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function PublicationsSkeleton() {
  return (
    <div className="space-y-0" role="status" aria-label="Loading publications">
      <span className="sr-only">Loading publications, please wait…</span>
      {/* Sticky header */}
      <div className="px-6 pt-6 pb-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-44 mb-1" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="bg-gray-100/80 p-1 rounded-md flex gap-1">
          {['Analytics', 'Articles', 'Pipeline', 'Categories', 'Types', 'Settings'].map((tab, i) => (
            <Skeleton
              key={tab}
              className={`h-8 flex-1 rounded-sm ${i === 0 ? '' : 'bg-transparent'}`}
            />
          ))}
        </div>

        {/* Analytics content area */}
        <div className="mt-6 space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-lg border border-border bg-white p-5 h-72">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-full w-full rounded" />
            </div>
            <div className="rounded-lg border border-border bg-white p-5 h-72">
              <Skeleton className="h-5 w-44 mb-4" />
              <Skeleton className="h-full w-full rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}