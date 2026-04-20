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

/**
 * P8.3 — Reusable skeleton primitives so per-page loading surfaces can
 * stop relying on an unstyled spinner. All primitives are
 * dependency-free wrappers around the same `<Skeleton/>` shadcn
 * component used by the dashboard so visual rhythm stays identical.
 */
export function SkeletonStack({ rows = 4, height = 'h-4' }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className={`${height} ${i === rows - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCardGrid({ cards = 3 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: cards }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <div className="pt-1 flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SkeletonList({ items = 6 }: { items?: number }) {
  return (
    <div className="divide-y divide-border rounded-md border bg-white" role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      ))}
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