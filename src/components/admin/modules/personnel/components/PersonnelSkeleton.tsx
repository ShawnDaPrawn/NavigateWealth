import React from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * PersonnelSkeleton
 *
 * Structural skeleton mirroring the PersonnelModule layout.
 * Used as the Suspense fallback so the page structure is visible
 * immediately during chunk load.
 *
 * Layout mirrors:
 * - Header (icon + title + 2 buttons)
 * - 4 stat cards (Total Personnel, Active, Suspended, Pending)
 * - Filter bar (search + category tabs + status filter)
 * - Data table
 */

function StatCardSkeleton() {
  return (
    <Card className="border border-gray-200/80 shadow-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TableRowSkeleton({ isLast = false }: { isLast?: boolean }) {
  return (
    <div
      className={`flex items-center gap-4 px-6 py-4 ${!isLast ? 'border-b border-gray-100' : ''}`}
    >
      <div className="flex items-center gap-3 w-60">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <Skeleton className="h-5 w-24 rounded-full" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-4 w-12" />
    </div>
  );
}

export function PersonnelSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto" role="status" aria-label="Loading personnel">
      <span className="sr-only">Loading personnel module, please wait…</span>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-52 mb-1" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Skeleton className="h-9 w-64 rounded-md" />
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-8 w-28 rounded-md ml-auto" />
      </div>

      {/* Data Table */}
      <Card className="border border-gray-200/80 shadow-none">
        <CardContent className="p-0">
          {/* Table header */}
          <div className="flex items-center gap-4 px-6 py-3 border-b bg-gray-50/50">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRowSkeleton key={i} isLast={i === 5} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}