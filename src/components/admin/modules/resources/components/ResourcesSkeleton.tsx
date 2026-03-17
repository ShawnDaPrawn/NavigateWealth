import React from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * ResourcesSkeleton
 *
 * Mirrors the ResourcesModule layout:
 * - Header (title + subtitle)
 * - 4-column tabs (Forms & Documents, Tools, Calculators, Key Manager)
 * - Sub-header (Form Management title + action buttons)
 * - Filter bar (search + category + client type + select btn)
 * - Forms list rows
 */

function FormRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
      <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-3 w-8 hidden lg:block" />
      <Skeleton className="h-3 w-16 hidden lg:block" />
      <Skeleton className="h-7 w-16 rounded-md" />
      <Skeleton className="h-7 w-16 rounded-md" />
    </div>
  );
}

export function ResourcesSkeleton() {
  return (
    <div className="space-y-8 p-6" role="status" aria-label="Loading resources">
      <span className="sr-only">Loading resources, please wait…</span>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-80" />
        </div>
      </div>

      {/* Main Tabs */}
      <div className="space-y-6">
        <div className="grid w-full grid-cols-4 h-12 rounded-md bg-muted p-1">
          <Skeleton className="h-full rounded-sm" />
          <Skeleton className="h-full rounded-sm bg-transparent" />
          <Skeleton className="h-full rounded-sm bg-transparent" />
          <Skeleton className="h-full rounded-sm bg-transparent" />
        </div>

        {/* Sub-header */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-64 mb-1" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>

        {/* Filter bar */}
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-end gap-4">
              <Skeleton className="h-10 flex-1 rounded-md" />
              <Skeleton className="h-10 w-44 rounded-md" />
              <Skeleton className="h-10 w-40 rounded-md" />
              <Skeleton className="h-10 w-20 rounded-md" />
            </div>
          </CardContent>
        </Card>

        {/* Forms list */}
        <div className="border rounded-lg divide-y bg-white">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <FormRowSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}