import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * RequestsSkeleton
 *
 * Mirrors the RequestsModule layout:
 * - Header (title + Templates button + New Request button)
 * - Kanban board (3 columns: New, Pending, Completed)
 */

function KanbanColumnSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex-1 min-w-[280px]">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-3 mb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-3 px-1">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RequestsSkeleton() {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading requests">
      <span className="sr-only">Loading requests, please wait…</span>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-36 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex gap-6 overflow-x-auto pb-4">
        <KanbanColumnSkeleton cards={3} />
        <KanbanColumnSkeleton cards={2} />
        <KanbanColumnSkeleton cards={2} />
      </div>
    </div>
  );
}