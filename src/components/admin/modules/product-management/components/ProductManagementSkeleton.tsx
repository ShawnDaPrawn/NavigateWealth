import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * ProductManagementSkeleton
 *
 * Mirrors the ProductManagementModule layout:
 * - Header (title + subtitle)
 * - 4-column tab bar (Provider Management, Product Structure, Key Manager, Integrations)
 * - Content area with cards
 */

function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function ProductManagementSkeleton() {
  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto" role="status" aria-label="Loading product management">
      <span className="sr-only">Loading product management, please wait…</span>
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64 mb-1" />
        <Skeleton className="h-5 w-[600px] max-w-full" />
      </div>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="grid w-full grid-cols-4 h-10 rounded-md bg-muted p-1">
          <Skeleton className="h-full rounded-sm" />
          <Skeleton className="h-full rounded-sm bg-transparent" />
          <Skeleton className="h-full rounded-sm bg-transparent" />
          <Skeleton className="h-full rounded-sm bg-transparent" />
        </div>

        {/* Content area — provider cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}