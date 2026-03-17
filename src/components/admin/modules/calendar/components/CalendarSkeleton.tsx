import React from 'react';
import { Skeleton } from '../../../../ui/skeleton';

/**
 * CalendarSkeleton
 *
 * Mirrors the CalendarModule layout:
 * - Header (title + buttons)
 * - Search / filter bar
 * - Full-height calendar view area
 */

export function CalendarSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50/30" role="status" aria-label="Loading calendar">
      <span className="sr-only">Loading calendar, please wait…</span>
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Header + search combined */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-36 mb-2" />
              <Skeleton className="h-5 w-72" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-28 rounded-md" />
              <Skeleton className="h-10 w-28 rounded-md" />
            </div>
          </div>

          {/* Search / filter bar */}
          <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center gap-2">
            <Skeleton className="h-12 flex-1 w-full rounded-lg" />
            <div className="h-8 w-px bg-gray-200 hidden md:block" />
            <div className="flex gap-2 w-full md:w-auto px-2">
              <Skeleton className="h-10 flex-1 md:w-24 rounded-md" />
              <Skeleton className="h-10 flex-1 md:w-24 rounded-md" />
            </div>
          </div>
        </div>

        {/* Calendar view */}
        <div className="h-[calc(100vh-250px)] min-h-[600px] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4">
          {/* Month header */}
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-7 w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-px mb-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="text-center py-2">
                <Skeleton className="h-4 w-8 mx-auto" />
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px flex-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="border border-gray-100 rounded p-2 min-h-[80px]">
                <Skeleton className="h-4 w-6 mb-2" />
                {i % 5 === 0 && <Skeleton className="h-3 w-full rounded mb-1" />}
                {i % 7 === 2 && <Skeleton className="h-3 w-3/4 rounded mb-1" />}
                {i % 4 === 1 && <Skeleton className="h-3 w-full rounded" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}