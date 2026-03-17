import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * TasksSkeleton
 *
 * Structural skeleton mirroring the TaskManagementModule layout.
 * Used as the Suspense fallback so the Kanban board structure is visible
 * immediately during chunk load.
 *
 * Layout mirrors:
 * - Header (title + 2 buttons) with bottom border
 * - 4 stat cards (Total Tasks, To Do, In Progress, Completed)
 * - Filter bar (search + status dropdown)
 * - 3-column Kanban board
 */

function TaskStatCardSkeleton() {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-12 mb-1" />
      <Skeleton className="h-3 w-32 mt-1" />
    </div>
  );
}

function KanbanColumnSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="flex-1 min-w-[300px] max-w-[400px]">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-3 mb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>

      {/* Task cards */}
      <div className="space-y-3 px-1">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm"
          >
            {/* Priority + tag row */}
            <div className="flex items-center gap-2 mb-3">
              <Skeleton className="h-4 w-14 rounded-full" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            {/* Title */}
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-3 w-3/4 mb-3" />
            {/* Footer: avatar + date */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TasksSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50/30 pb-10" role="status" aria-label="Loading tasks">
      <span className="sr-only">Loading tasks, please wait…</span>
      <div className="max-w-[1800px] mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-gray-200/60">
          <div>
            <Skeleton className="h-8 w-52 mb-2" />
            <Skeleton className="h-5 w-80" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <TaskStatCardSkeleton />
          <TaskStatCardSkeleton />
          <TaskStatCardSkeleton />
          <TaskStatCardSkeleton />
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-2 max-w-3xl">
          <Skeleton className="h-10 flex-1 w-full rounded-lg" />
          <div className="w-px h-6 bg-gray-200 hidden md:block" />
          <Skeleton className="h-10 w-full md:w-[180px] rounded-lg" />
        </div>

        {/* Kanban Board */}
        <div className="h-[calc(100vh-380px)] min-h-[500px] overflow-hidden">
          <div className="flex gap-6 h-full overflow-x-auto pb-4 px-1">
            <KanbanColumnSkeleton cards={4} />
            <KanbanColumnSkeleton cards={3} />
            <KanbanColumnSkeleton cards={2} />
          </div>
        </div>
      </div>
    </div>
  );
}