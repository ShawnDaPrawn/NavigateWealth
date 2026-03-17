import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * ReportingSkeleton
 *
 * Mirrors the ReportingModule layout:
 * - Header (title + New Report button)
 * - Recent report runs section
 * - Reports table
 */

function ReportRunSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-white">
      <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-2 w-24 rounded-full" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
      <Skeleton className="h-4 w-48 flex-1" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-20 rounded-md" />
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  );
}

export function ReportingSkeleton() {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading reporting">
      <span className="sr-only">Loading reporting module, please wait…</span>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-36 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Recent report runs */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-36" />
        <ReportRunSkeleton />
        <ReportRunSkeleton />
      </div>

      {/* Reports table */}
      <div className="rounded-md border border-border bg-white">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/50">
          <Skeleton className="h-4 w-32 flex-1" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-8" />
        </div>
        {[1, 2, 3, 4].map(i => (
          <TableRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}