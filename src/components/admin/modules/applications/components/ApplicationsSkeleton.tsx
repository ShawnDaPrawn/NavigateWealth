import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * ApplicationsSkeleton
 *
 * Structural skeleton mirroring the ApplicationsModule layout.
 * Used as the Suspense fallback so the page structure is visible
 * immediately during chunk load.
 *
 * Layout mirrors:
 * - Header (title + 2 action buttons)
 * - 5-column stats cards (Pending, Invited, Approved, Rejected, Total)
 * - Applications table with search bar
 */

function StatsCardSkeleton({ active = false }: { active?: boolean }) {
  return (
    <div
      className={`bg-white p-5 rounded-xl border text-left ${
        active
          ? 'border-[#6d28d9]/30 shadow-sm ring-1 ring-[#6d28d9]/20'
          : 'border-gray-100'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-12 mb-1" />
      <Skeleton className="h-3 w-28 mt-1" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-20 rounded-md" />
    </div>
  );
}

export function ApplicationsSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto" role="status" aria-label="Loading applications">
      <span className="sr-only">Loading applications, please wait…</span>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-36 rounded-md" />
        </div>
      </div>

      {/* Stats Cards — 5 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCardSkeleton active />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
        <StatsCardSkeleton />
      </div>

      {/* Table area */}
      <div className="space-y-4">
        {/* Search / action bar */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>

        {/* Table */}
        <div className="rounded-md border border-border">
          {/* Table header */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/50">
            <Skeleton className="h-4 w-40 flex-1" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <TableRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}