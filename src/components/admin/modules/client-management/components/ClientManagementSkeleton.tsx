import React from 'react';
import { Card, CardContent, CardHeader } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * ClientManagementSkeleton
 *
 * Structural skeleton mirroring the ClientManagementModule layout.
 * Used as the Suspense fallback so the page structure (stat cards, tabs,
 * filter bar, table) is visible immediately during chunk load.
 *
 * Layout mirrors:
 * - Header (title + action buttons)
 * - 4 stat cards (Total Clients, Active, Suspended, Closed)
 * - Tab bar (Personal, Corporate, Adviser)
 * - Search + filter bar
 * - Data table skeleton
 */

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-7 rounded-md" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-7 w-12 mb-1" />
        <Skeleton className="h-4 w-36" />
      </CardContent>
    </Card>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
      {/* Avatar + name */}
      <div className="flex items-center gap-3 flex-1 min-w-0" style={{ maxWidth: '350px' }}>
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      {/* ID number */}
      <Skeleton className="h-4 w-28" />
      {/* Date joined */}
      <Skeleton className="h-4 w-24" />
      {/* Account badge */}
      <Skeleton className="h-5 w-16 rounded-full" />
      {/* Application badge */}
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export function ClientManagementSkeleton() {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading client management">
      <span className="sr-only">Loading client management, please wait…</span>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Tabs */}
      <div className="w-full">
        <div className="grid w-full grid-cols-3 h-10 rounded-md bg-muted p-1">
          <Skeleton className="h-full rounded-sm" />
          <Skeleton className="h-full rounded-sm bg-transparent" />
          <Skeleton className="h-full rounded-sm bg-transparent" />
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 my-4">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>

        {/* Table header */}
        <div className="rounded-md border border-border">
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/50">
            <Skeleton className="h-4 w-16" style={{ maxWidth: '350px', flex: 1 }} />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          {/* Table rows */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <TableRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}