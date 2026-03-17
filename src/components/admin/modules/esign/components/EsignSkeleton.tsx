import React from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * EsignSkeleton
 *
 * Mirrors the EsignModule dashboard layout:
 * - Header (title + "Start New Envelope" button)
 * - 4 metric cards (Action Required, Completed, Drafts, Completion Rate)
 * - 2-tab bar (Envelopes / Templates)
 * - Table skeleton
 */

function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </CardContent>
    </Card>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
      <Skeleton className="h-4 w-48 flex-1" />
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-16 rounded-md" />
    </div>
  );
}

export function EsignSkeleton() {
  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden" role="status" aria-label="Loading e-sign">
      <span className="sr-only">Loading e-sign module, please wait…</span>
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-7 w-56 mb-2" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-44 rounded-md" />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </div>

          {/* Tabs */}
          <div className="space-y-4">
            <div className="grid w-full grid-cols-2 h-10 rounded-md bg-muted p-1">
              <Skeleton className="h-full rounded-sm" />
              <Skeleton className="h-full rounded-sm bg-transparent" />
            </div>

            {/* Table */}
            <div className="rounded-md border border-border bg-white">
              <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/50">
                <Skeleton className="h-4 w-36 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              {[1, 2, 3, 4, 5].map(i => (
                <TableRowSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}